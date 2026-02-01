/**
 * Signaling transport that combines WebSocket signaling + WebRTC P2P + WebSocket relay fallback.
 *
 * Architecture:
 * - WebSocket is always connected for signaling and peer discovery
 * - WebRTC data channels are established for P2P communication (preferred)
 * - WebSocket relay is used as fallback when WebRTC fails
 */

import { createLogger } from "@arnott/logger";
import type { Transport, TransportState, SyncMessage, TransportType } from "./types";

const log = createLogger("sync:signaling");
const rtcLog = createLogger("sync:webrtc");

// Use VITE_API_URL in production, empty string (relative) in dev
const API_BASE = import.meta.env.VITE_API_URL || "";

function getWsUrl(): string {
  if (API_BASE) {
    return API_BASE.replace(/^http/, "ws");
  }
  if (import.meta.env.DEV) {
    return "ws://localhost:8787";
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

const WS_BASE = getWsUrl();

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

const DEFAULT_RECONNECT_BACKOFF = {
  initial: 1000,
  max: 30000,
  multiplier: 2,
};

/** Peer state for WebRTC connection */
interface PeerState {
  id: string;
  rtcConnection: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  rtcConnected: boolean;
  remoteDescriptionSet: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  timeOffset: number;
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
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
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
 * Combined transport for WebSocket signaling + WebRTC P2P + WebSocket relay.
 * Reports as "webrtc" when P2P is working, "websocket" when using relay.
 */
export class SignalingTransport implements Transport {
  readonly name: TransportType = "webrtc";

  private ws: WebSocket | null = null;
  private peers = new Map<string, PeerState>();
  private myPeerId: string | null = null;
  private roomId: string | null = null;
  private _state: TransportState = "disconnected";
  private intentionalDisconnect = false;
  private isConnecting = false;
  private reconnectAttempt = 0;
  private reconnectTimeout: number | null = null;

  private options: Required<SignalingTransportOptions>;

  // Callbacks
  onMessage: ((message: SyncMessage) => void) | null = null;
  onStateChange: ((state: TransportState) => void) | null = null;
  onPeerConnect: ((peerId: string) => void) | null = null;
  onPeerDisconnect: ((peerId: string) => void) | null = null;

  constructor(options: SignalingTransportOptions = {}) {
    this.options = {
      enableWebRTC: options.enableWebRTC ?? true,
      autoReconnect: options.autoReconnect ?? true,
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

  /** Get our peer ID (assigned by server) */
  getPeerId(): string | null {
    return this.myPeerId;
  }

  /** Get count of known peers */
  getPeerCount(): number {
    return this.peers.size;
  }

  /** Check if a peer has WebRTC connection */
  hasPeerRTC(peerId: string): boolean {
    const peer = this.peers.get(peerId);
    return peer?.rtcConnected ?? false;
  }

  /** Get time offset for a peer */
  getPeerTimeOffset(peerId: string): number {
    return this.peers.get(peerId)?.timeOffset ?? 0;
  }

  /** Set time offset for a peer */
  setPeerTimeOffset(peerId: string, offset: number): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.timeOffset = offset;
    }
  }

  async connect(roomId: string): Promise<void> {
    if (this.isConnecting) {
      return;
    }

    if (this._state === "connected" && this.roomId === roomId) {
      return;
    }

    this.isConnecting = true;
    this.intentionalDisconnect = false;

    try {
      // Clean up previous connection
      await this.cleanup();

      this.roomId = roomId;
      this.setState("connecting");

      await this.connectWebSocket();
    } finally {
      this.isConnecting = false;
    }
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE}/api/signal/ws?roomId=${encodeURIComponent(this.roomId!)}`);
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
        this.peers.clear();

        if (!this.intentionalDisconnect) {
          this.setState("disconnected");
          if (this.options.autoReconnect) {
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
    resolveConnect?: () => void
  ): Promise<void> {
    // Binary data = relayed from another peer via WebSocket
    if (event.data instanceof ArrayBuffer) {
      this.onMessage?.({
        data: event.data,
        source: {
          transport: "websocket",
          peerId: "ws-relay",
          isLocalTab: false,
          timeOffset: 0,
        },
        receivedAt: performance.now(),
      });
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
      this.myPeerId = peerId;
      this.reconnectAttempt = 0;
      this.setState("connected");

      // Track all existing peers
      for (const remotePeerId of peers) {
        this.peers.set(remotePeerId, this.createPeerState(remotePeerId));
      }

      // Initiate WebRTC connections if enabled
      if (this.options.enableWebRTC) {
        for (const remotePeerId of peers) {
          await this.initiateWebRTC(remotePeerId);
        }
      }

      resolveConnect?.();
    } else if (msg.type === "peer-joined") {
      const { peerId } = msg;
      // Add peer but don't call onPeerConnect yet - wait for data channel
      // The new peer will initiate WebRTC to us
      this.peers.set(peerId, this.createPeerState(peerId));
    } else if (msg.type === "peer-left") {
      const { peerId } = msg;
      this.removePeer(peerId);
    } else if (msg.type === "offer" || msg.type === "answer" || msg.type === "ice") {
      await this.handleSignal(msg);
    }
  }

  private createPeerState(peerId: string): PeerState {
    return {
      id: peerId,
      rtcConnection: null,
      dataChannel: null,
      rtcConnected: false,
      remoteDescriptionSet: false,
      pendingCandidates: [],
      timeOffset: 0,
    };
  }

  private removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.dataChannel?.close();
      peer.rtcConnection?.close();
      this.peers.delete(peerId);
      this.onPeerDisconnect?.(peerId);
    }
  }

  private async initiateWebRTC(remotePeerId: string): Promise<void> {
    const peer = this.peers.get(remotePeerId);
    if (!peer || peer.rtcConnection) return;

    this.setupRTCConnection(peer, true);

    try {
      const offer = await peer.rtcConnection!.createOffer();
      await peer.rtcConnection!.setLocalDescription(offer);
      this.sendSignal("offer", remotePeerId, { sdp: offer.sdp });
    } catch (err) {
      rtcLog.debug("WebRTC offer failed, using WS relay", { peerId: remotePeerId, error: err });
    }
  }

  private setupRTCConnection(peer: PeerState, isInitiator: boolean): void {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peer.rtcConnection = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        rtcLog.debug("ICE candidate", {
          peerId: peer.id,
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
        });
        this.sendSignal("ice", peer.id, {
          candidate: event.candidate.toJSON(),
        });
      } else {
        rtcLog.debug("ICE gathering complete", { peerId: peer.id });
      }
    };

    pc.onicegatheringstatechange = () => {
      rtcLog.debug("ICE gathering state", { peerId: peer.id, state: pc.iceGatheringState });
    };

    pc.oniceconnectionstatechange = () => {
      rtcLog.info("ICE connection state", { peerId: peer.id, state: pc.iceConnectionState });
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        peer.rtcConnected = false;
      }
    };

    pc.onconnectionstatechange = () => {
      rtcLog.info("Connection state", { peerId: peer.id, state: pc.connectionState });
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        peer.rtcConnected = false;
      }
    };

    const setupDataChannel = (channel: RTCDataChannel) => {
      channel.onopen = () => {
        peer.dataChannel = channel;
        peer.rtcConnected = true;
        this.onPeerConnect?.(peer.id);
      };

      channel.onclose = () => {
        if (peer.rtcConnected) {
          peer.rtcConnected = false;
          this.onPeerDisconnect?.(peer.id);
        }
      };

      channel.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
        let data: unknown;
        if (event.data instanceof ArrayBuffer) {
          data = event.data;
        } else {
          try {
            data = JSON.parse(event.data);
          } catch (err) {
            rtcLog.debug("Failed to parse data channel message, using raw", { error: err });
            data = event.data;
          }
        }

        this.onMessage?.({
          data,
          source: {
            transport: "webrtc",
            peerId: peer.id,
            isLocalTab: false,
            timeOffset: peer.timeOffset,
          },
          receivedAt: performance.now(),
        });
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
  }

  private async handleSignal(signal: SignalMessage): Promise<void> {
    const { type, from, sdp, candidate } = signal;
    rtcLog.debug("Received signal", { type, from });

    let peer = this.peers.get(from);
    if (!peer) {
      peer = this.createPeerState(from);
      this.peers.set(from, peer);
    }

    if (type === "offer") {
      if (!peer.rtcConnection) {
        this.setupRTCConnection(peer, false);
      }

      try {
        await peer.rtcConnection!.setRemoteDescription({ type: "offer", sdp });
        peer.remoteDescriptionSet = true;
        await this.processPendingCandidates(peer);

        const answer = await peer.rtcConnection!.createAnswer();
        await peer.rtcConnection!.setLocalDescription(answer);
        this.sendSignal("answer", from, { sdp: answer.sdp });
      } catch (err) {
        rtcLog.debug("Failed to handle offer", { peerId: from, error: err });
      }
    } else if (type === "answer") {
      if (peer.rtcConnection) {
        try {
          await peer.rtcConnection.setRemoteDescription({ type: "answer", sdp });
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
          rtcLog.debug("Failed to add ICE candidate", { peerId: from, error: err });
        }
      } else {
        peer.pendingCandidates.push(candidate);
      }
    }
  }

  private async processPendingCandidates(peer: PeerState): Promise<void> {
    if (peer.pendingCandidates.length > 0 && peer.rtcConnection) {
      for (const candidate of peer.pendingCandidates) {
        try {
          await peer.rtcConnection.addIceCandidate(candidate);
        } catch (err) {
          rtcLog.debug("Failed to add pending ICE candidate", { peerId: peer.id, error: err });
        }
      }
      peer.pendingCandidates = [];
    }
  }

  private sendSignal(type: string, to: string, payload: Record<string, unknown>): void {
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

    this.setState("reconnecting");
    const { initial, max, multiplier } = this.options.reconnectBackoff;
    const delay = Math.min(initial * Math.pow(multiplier, this.reconnectAttempt), max);
    this.reconnectAttempt++;

    this.reconnectTimeout = window.setTimeout(() => {
      void this.connect(this.roomId!);
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

  broadcast(data: ArrayBuffer | string): void {
    if (this._state !== "connected") {
      return;
    }

    const isBinary = data instanceof ArrayBuffer;
    let hasWsOnlyPeers = false;

    // Send to peers with WebRTC data channels
    for (const [, peer] of this.peers) {
      if (peer.rtcConnected && peer.dataChannel?.readyState === "open") {
        if (isBinary) {
          peer.dataChannel.send(data);
        } else {
          peer.dataChannel.send(data);
        }
      } else {
        hasWsOnlyPeers = true;
      }
    }

    // Send via WebSocket relay for peers without WebRTC
    if (hasWsOnlyPeers && this.ws?.readyState === WebSocket.OPEN) {
      if (isBinary) {
        this.ws.send(data);
      } else {
        this.ws.send(JSON.stringify({ type: "relay-json", data }));
      }
    }
  }

  sendTo(peerId: string, data: ArrayBuffer | string): void {
    const peer = this.peers.get(peerId);
    if (peer?.rtcConnected && peer.dataChannel?.readyState === "open") {
      if (data instanceof ArrayBuffer) {
        peer.dataChannel.send(data);
      } else {
        peer.dataChannel.send(data);
      }
    }
    // No WebSocket fallback for sendTo - it's for targeted messages
  }

  private setState(state: TransportState): void {
    if (this._state !== state) {
      this._state = state;
      this.onStateChange?.(state);
    }
  }
}
