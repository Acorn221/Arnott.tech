/**
 * SignalingTransport - WebSocket signaling + WebRTC P2P + WebSocket relay.
 *
 * Implements the ITransport interface for the new sync architecture.
 *
 * Architecture:
 * - WebSocket is always connected for signaling and peer discovery
 * - WebRTC data channels are established for P2P (preferred)
 * - WebSocket relay is used as fallback when WebRTC fails
 */

import { createLogger } from "@arnott/logger";

import {
  RECONNECT_BACKOFF_MULTIPLIER,
  RECONNECT_INITIAL_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  WEBRTC_CONNECTION_TIMEOUT_MS,
} from "../config";
import type { ITransport } from "../interfaces/transport";
import {
  SYNC_ROOM_ID,
  type TransportConfig,
  type TransportState,
} from "../interfaces/types";

const log = createLogger("sync:signaling");
const rtcLog = createLogger("sync:webrtc");

// Use VITE_API_URL in production, empty string (relative) in dev
const API_BASE = import.meta.env.VITE_API_URL || "";

function getWsUrl(signalingUrl?: string): string {
  if (signalingUrl) {
    return signalingUrl;
  }
  if (API_BASE) {
    return API_BASE.replace(/^http/, "ws");
  }
  if (import.meta.env.DEV) {
    return "ws://localhost:8787";
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

const DEFAULT_RECONNECT_BACKOFF = {
  initial: RECONNECT_INITIAL_DELAY_MS,
  max: RECONNECT_MAX_DELAY_MS,
  multiplier: RECONNECT_BACKOFF_MULTIPLIER,
};

/** Internal peer connection state */
interface PeerConnection {
  id: string;
  rtcConnection: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  rtcConnected: boolean;
  remoteDescriptionSet: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  rtcTimeout: number | null;
}

/** Signaling messages from server */
interface WelcomeMessage {
  type: "welcome";
  peerId: string;
  peers: string[];
}

interface PeerEventMessage {
  type: "peer-joined" | "peer-left";
  peerId: string;
}

interface SignalMessage {
  type: "offer" | "answer" | "ice";
  from: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

type ServerMessage = WelcomeMessage | PeerEventMessage | SignalMessage;

export interface SignalingTransportOptions {
  /** Enable WebRTC P2P connections (default: true) */
  enableWebRTC?: boolean;
  /** Max reconnect attempts (default: 5) */
  maxReconnectAttempts?: number;
  /** Reconnect backoff config */
  reconnectBackoff?: {
    initial: number;
    max: number;
    multiplier: number;
  };
}

/**
 * SignalingTransport - WebSocket + WebRTC transport.
 *
 * Implements ITransport interface. Reports type as "webrtc" since
 * that's the preferred path when available.
 */
export class SignalingTransport implements ITransport {
  readonly type = "webrtc" as const;

  private ws: WebSocket | null = null;
  private peers = new Map<string, PeerConnection>();
  private myPeerId: string | null = null;
  private signalingUrl: string | null = null;
  private _state: TransportState = "disconnected";
  private intentionalDisconnect = false;
  private isConnecting = false;
  private reconnectAttempt = 0;
  private reconnectTimeout: number | null = null;
  private autoReconnect = true;

  private options: Required<SignalingTransportOptions>;

  // --- ITransport Callbacks ---
  onReceive: ((peerId: string, data: ArrayBuffer) => void) | null = null;
  onPeerReachable: ((peerId: string, isLocal: boolean) => void) | null = null;
  onPeerUnreachable: ((peerId: string) => void) | null = null;
  onStateChange: ((state: TransportState) => void) | null = null;
  /** Called when WebRTC status changes (connects or disconnects) */
  onWebRTCChange: (() => void) | null = null;

  constructor(options: SignalingTransportOptions = {}) {
    this.options = {
      enableWebRTC: options.enableWebRTC ?? true,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      reconnectBackoff: options.reconnectBackoff ?? DEFAULT_RECONNECT_BACKOFF,
    };
  }

  get state(): TransportState {
    return this._state;
  }

  get isSupported(): boolean {
    return typeof WebSocket !== "undefined";
  }

  getLocalId(): string {
    return this.myPeerId ?? "";
  }

  /** Check if a peer has WebRTC connection */
  hasPeerRTC(peerId: string): boolean {
    const peer = this.peers.get(peerId);
    return peer?.rtcConnected ?? false;
  }

  async connect(config: TransportConfig = {}): Promise<void> {
    const { signalingUrl, autoReconnect } = config;

    if (this.isConnecting || this._state === "connected") {
      return;
    }

    this.isConnecting = true;
    this.intentionalDisconnect = false;
    this.autoReconnect = autoReconnect ?? true;
    this.signalingUrl = signalingUrl ?? null;

    try {
      await this.cleanup();
      this.setState("connecting");
      await this.connectWebSocket();
    } finally {
      this.isConnecting = false;
    }
  }

  private async connectWebSocket(): Promise<void> {
    const wsBase = getWsUrl(this.signalingUrl ?? undefined);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `${wsBase}/api/signal/ws?roomId=${encodeURIComponent(SYNC_ROOM_ID)}`,
      );
      ws.binaryType = "arraybuffer";
      this.ws = ws;

      ws.onopen = () => {
        // Wait for welcome message to complete connection
      };

      ws.onmessage = async (event) => {
        await this.handleWebSocketMessage(event, resolve);
      };

      ws.onclose = () => {
        if (this.ws !== ws) return;

        this.ws = null;

        // Notify peer loss for all peers
        for (const peerId of this.peers.keys()) {
          this.onPeerUnreachable?.(peerId);
        }
        this.peers.clear();

        if (!this.intentionalDisconnect) {
          this.setState("disconnected");
          if (this.autoReconnect) {
            this.attemptReconnect();
          }
        }
      };

      ws.onerror = () => {
        reject(new Error("WebSocket connection failed"));
      };
    });
  }

  private async handleWebSocketMessage(
    event: MessageEvent,
    resolveConnect?: () => void,
  ): Promise<void> {
    // Binary data = relayed from another peer via WebSocket
    // Server wraps with 8-byte sender ID header
    if (event.data instanceof ArrayBuffer && event.data.byteLength > 8) {
      const view = new Uint8Array(event.data);
      const senderId = new TextDecoder()
        .decode(view.slice(0, 8))
        .replace(/\0/g, "");
      const payload = event.data.slice(8);

      this.onReceive?.(senderId, payload);
      return;
    }

    if (typeof event.data !== "string") {
      return;
    }

    let msg: ServerMessage;
    try {
      msg = JSON.parse(event.data) as ServerMessage;
    } catch (err) {
      log.debug("Failed to parse server message", { error: err });
      return;
    }

    if (msg.type === "welcome") {
      const { peerId, peers } = msg;
      log.debug("Received welcome", { peerId, peers, peerCount: peers.length });
      this.myPeerId = peerId;
      this.reconnectAttempt = 0;
      this.setState("connected");

      // Report all existing peers as reachable (remote, not local)
      for (const remotePeerId of peers) {
        log.debug("Adding peer from welcome", { remotePeerId });
        this.peers.set(remotePeerId, this.createPeerConnection(remotePeerId));
        this.onPeerReachable?.(remotePeerId, false);
      }

      // Initiate WebRTC connections if enabled
      // Use peer ID comparison as tie-breaker - lower ID always initiates
      if (this.options.enableWebRTC && this.myPeerId) {
        for (const remotePeerId of peers) {
          if (this.myPeerId < remotePeerId) {
            log.debug("Initiating WebRTC (we have lower ID)", {
              myId: this.myPeerId,
              remotePeerId,
            });
            await this.initiateWebRTC(remotePeerId);
          } else {
            log.debug("Waiting for WebRTC initiation (they have lower ID)", {
              myId: this.myPeerId,
              remotePeerId,
            });
          }
        }
      }

      resolveConnect?.();
    } else if (msg.type === "peer-joined") {
      const { peerId } = msg;
      log.debug("Peer joined", { peerId });
      this.peers.set(peerId, this.createPeerConnection(peerId));
      this.onPeerReachable?.(peerId, false);

      // Also initiate WebRTC to the new peer
      // Use peer ID comparison as tie-breaker to avoid both sides sending offers
      // Lower peer ID initiates the connection
      if (
        this.options.enableWebRTC &&
        this.myPeerId &&
        this.myPeerId < peerId
      ) {
        log.debug("Initiating WebRTC to new peer (we have lower ID)", {
          myId: this.myPeerId,
          peerId,
        });
        void this.initiateWebRTC(peerId);
      }
    } else if (msg.type === "peer-left") {
      const { peerId } = msg;
      this.removePeer(peerId);
    } else if (
      msg.type === "offer" ||
      msg.type === "answer" ||
      msg.type === "ice"
    ) {
      await this.handleSignal(msg);
    }
  }

  private createPeerConnection(peerId: string): PeerConnection {
    return {
      id: peerId,
      rtcConnection: null,
      dataChannel: null,
      rtcConnected: false,
      remoteDescriptionSet: false,
      pendingCandidates: [],
      rtcTimeout: null,
    };
  }

  private removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      if (peer.rtcTimeout) {
        clearTimeout(peer.rtcTimeout);
      }
      peer.dataChannel?.close();
      peer.rtcConnection?.close();
      this.peers.delete(peerId);
      this.onPeerUnreachable?.(peerId);
    }
  }

  private async initiateWebRTC(remotePeerId: string): Promise<void> {
    const peer = this.peers.get(remotePeerId);
    if (!peer || peer.rtcConnection) return;

    const rtcConnection = this.setupRTCConnection(peer, true);

    // Set timeout to clean up stalled WebRTC connections
    peer.rtcTimeout = window.setTimeout(() => {
      if (!peer.rtcConnected) {
        rtcLog.debug("WebRTC timeout, using WS relay", {
          peerId: remotePeerId,
        });
        peer.rtcConnection?.close();
        peer.rtcConnection = null;
        peer.dataChannel = null;
      }
    }, WEBRTC_CONNECTION_TIMEOUT_MS);

    try {
      const offer = await rtcConnection.createOffer();
      await rtcConnection.setLocalDescription(offer);
      this.sendSignal("offer", remotePeerId, { sdp: offer.sdp });
    } catch (err) {
      rtcLog.debug("WebRTC offer failed, using WS relay", {
        peerId: remotePeerId,
        error: err,
      });
    }
  }

  private setupRTCConnection(
    peer: PeerConnection,
    isInitiator: boolean,
  ): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peer.rtcConnection = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        rtcLog.debug("ICE candidate", {
          peerId: peer.id,
          type: event.candidate.type,
          protocol: event.candidate.protocol,
        });
        this.sendSignal("ice", peer.id, {
          candidate: event.candidate.toJSON(),
        });
      } else {
        rtcLog.debug("ICE gathering complete", { peerId: peer.id });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") {
        rtcLog.debug("ICE connected successfully!", { peerId: peer.id, state });
      } else if (state === "failed") {
        rtcLog.debug("ICE connection FAILED - falling back to WebSocket", {
          peerId: peer.id,
          state,
        });
        peer.rtcConnected = false;
      } else if (state === "disconnected") {
        rtcLog.debug("ICE disconnected", { peerId: peer.id, state });
        peer.rtcConnected = false;
      } else {
        rtcLog.debug("ICE state change", { peerId: peer.id, state });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        rtcLog.debug("WebRTC connection established!", { peerId: peer.id });
      } else if (state === "failed") {
        rtcLog.debug("WebRTC connection FAILED", { peerId: peer.id });
        peer.rtcConnected = false;
      } else if (state === "disconnected") {
        rtcLog.debug("WebRTC disconnected", { peerId: peer.id });
        peer.rtcConnected = false;
      } else {
        rtcLog.debug("WebRTC state change", { peerId: peer.id, state });
      }
    };

    const setupDataChannel = (channel: RTCDataChannel) => {
      channel.onopen = () => {
        peer.dataChannel = channel;
        peer.rtcConnected = true;
        if (peer.rtcTimeout) {
          clearTimeout(peer.rtcTimeout);
          peer.rtcTimeout = null;
        }
        rtcLog.debug("Data channel OPEN - WebRTC P2P active!", {
          peerId: peer.id,
          label: channel.label,
        });
        // Notify that WebRTC status changed
        this.onWebRTCChange?.();
      };

      channel.onclose = () => {
        if (peer.rtcConnected) {
          peer.rtcConnected = false;
          rtcLog.debug("Data channel closed", { peerId: peer.id });
          // Notify that WebRTC status changed
          this.onWebRTCChange?.();
        }
      };

      channel.onerror = (event) => {
        rtcLog.debug("Data channel error", { peerId: peer.id, error: event });
      };

      channel.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (event.data instanceof ArrayBuffer) {
          this.onReceive?.(peer.id, event.data);
        }
      };
    };

    if (isInitiator) {
      const dataChannel = pc.createDataChannel("data", {
        ordered: false,
        maxRetransmits: 0,
      });
      setupDataChannel(dataChannel);
      peer.dataChannel = dataChannel;
    } else {
      pc.ondatachannel = (event) => {
        peer.dataChannel = event.channel;
        setupDataChannel(event.channel);
      };
    }

    return pc;
  }

  private async handleSignal(signal: SignalMessage): Promise<void> {
    const { type, from, sdp, candidate } = signal;
    rtcLog.debug("Received signal", { type, from });

    let peer = this.peers.get(from);
    if (!peer) {
      peer = this.createPeerConnection(from);
      this.peers.set(from, peer);
      this.onPeerReachable?.(from, false);
    }

    if (type === "offer") {
      const rtcConnection =
        peer.rtcConnection ?? this.setupRTCConnection(peer, false);

      try {
        await rtcConnection.setRemoteDescription({ type: "offer", sdp });
        peer.remoteDescriptionSet = true;
        await this.processPendingCandidates(peer);

        const answer = await rtcConnection.createAnswer();
        await rtcConnection.setLocalDescription(answer);
        this.sendSignal("answer", from, { sdp: answer.sdp });
      } catch (err) {
        rtcLog.debug("Failed to handle offer", { peerId: from, error: err });
      }
    } else if (type === "answer") {
      if (peer.rtcConnection) {
        try {
          await peer.rtcConnection.setRemoteDescription({
            type: "answer",
            sdp,
          });
          peer.remoteDescriptionSet = true;
          await this.processPendingCandidates(peer);
        } catch (err) {
          rtcLog.debug("Failed to handle answer", { peerId: from, error: err });
        }
      }
    } else if (type === "ice" && candidate) {
      if (peer.remoteDescriptionSet && peer.rtcConnection) {
        try {
          await peer.rtcConnection.addIceCandidate(candidate);
        } catch (err) {
          rtcLog.debug("Failed to add ICE candidate", {
            peerId: from,
            error: err,
          });
        }
      } else {
        peer.pendingCandidates.push(candidate);
      }
    }
  }

  private async processPendingCandidates(peer: PeerConnection): Promise<void> {
    if (peer.pendingCandidates.length > 0 && peer.rtcConnection) {
      for (const candidate of peer.pendingCandidates) {
        try {
          await peer.rtcConnection.addIceCandidate(candidate);
        } catch (err) {
          rtcLog.debug("Failed to add pending ICE candidate", {
            peerId: peer.id,
            error: err,
          });
        }
      }
      peer.pendingCandidates = [];
    }
  }

  private sendSignal(
    type: string,
    to: string,
    payload: Record<string, unknown>,
  ): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, to, ...payload }));
    }
  }

  private attemptReconnect(): void {
    if (this.intentionalDisconnect || !navigator.onLine) {
      return;
    }

    if (this.reconnectAttempt >= this.options.maxReconnectAttempts) {
      this.setState("disconnected");
      return;
    }

    // Map internal reconnecting to "connecting" for ITransport
    this.setState("connecting");
    const { initial, max, multiplier } = this.options.reconnectBackoff;
    const delay = Math.min(
      initial * Math.pow(multiplier, this.reconnectAttempt),
      max,
    );
    this.reconnectAttempt++;

    log.debug("Attempting reconnect", {
      attempt: this.reconnectAttempt,
      delay,
    });

    this.reconnectTimeout = window.setTimeout(() => {
      void this.connect({ signalingUrl: this.signalingUrl ?? undefined });
    }, delay);
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    await this.cleanup();
    this.setState("disconnected");
  }

  private async cleanup(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    for (const [, peer] of this.peers) {
      if (peer.rtcTimeout) {
        clearTimeout(peer.rtcTimeout);
      }
      peer.dataChannel?.close();
      peer.rtcConnection?.close();
    }
    this.peers.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.myPeerId = null;
  }

  /**
   * Broadcast data to all reachable peers.
   * Uses both WebRTC data channels AND WebSocket relay for reliability.
   * (WebRTC can be unreliable on some mobile browsers like Safari on iOS)
   */
  broadcast(data: ArrayBuffer): void {
    if (this._state !== "connected") {
      return;
    }

    // Send to peers with WebRTC data channels
    for (const [, peer] of this.peers) {
      if (peer.rtcConnected && peer.dataChannel?.readyState === "open") {
        peer.dataChannel.send(data);
      }
    }

    // Always also send via WebSocket relay for reliability
    // Server will deduplicate if peer receives via both channels
    if (this.peers.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  /**
   * Send data to a specific peer.
   * Uses WebRTC data channel when available, falls back to WebSocket relay.
   */
  send(peerId: string, data: ArrayBuffer): void {
    if (this._state !== "connected") {
      return;
    }

    const peer = this.peers.get(peerId);

    // Prefer WebRTC
    if (peer?.rtcConnected && peer.dataChannel?.readyState === "open") {
      peer.dataChannel.send(data);
      return;
    }

    // Fallback to WebSocket targeted relay
    if (this.ws?.readyState === WebSocket.OPEN) {
      const payload = btoa(String.fromCharCode(...new Uint8Array(data)));
      this.ws.send(JSON.stringify({ type: "relay-to", to: peerId, payload }));
    }
  }

  private setState(state: TransportState): void {
    if (this._state !== state) {
      log.debug("State change", { from: this._state, to: state });
      this._state = state;
      this.onStateChange?.(state);
    }
  }
}
