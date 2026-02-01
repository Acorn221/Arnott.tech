/**
 * TransportManager coordinates multiple transports for unified sync.
 *
 * Responsibilities:
 * - Manages transport lifecycle (connect/disconnect)
 * - Deduplicates messages received via multiple transports
 * - Handles time sync with peers
 * - Aggregates peer counts and connection state
 */

import type {
  TransportState,
  SyncMessage,
  TransportManagerOptions,
  PeerInfo,
} from "./types";
import { BroadcastTransport } from "./broadcast-transport";
import { SignalingTransport } from "./signaling-transport";

/** Simple LRU cache for message deduplication */
class MessageCache {
  private cache = new Map<string, number>();
  private readonly maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  set(key: string, timestamp: number): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, timestamp);
  }
}

/** Generate message ID for deduplication */
function getMessageId(data: unknown): string | null {
  if (data instanceof ArrayBuffer) {
    // Use first 16 bytes as fingerprint (covers type + timestamp + rotation)
    const view = new Uint8Array(data.slice(0, 16));
    return Array.from(view).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  return null; // JSON messages are typically unique
}

export class TransportManager {
  private broadcastTransport: BroadcastTransport | null = null;
  private signalingTransport: SignalingTransport | null = null;
  private messageCache = new MessageCache();
  private peers = new Map<string, PeerInfo>();
  private roomId: string;
  private options: Required<TransportManagerOptions>;

  private _state: TransportState = "disconnected";

  // Callbacks
  onMessage: ((message: SyncMessage) => void) | null = null;
  onStateChange: ((state: TransportState) => void) | null = null;
  onPeerConnect: ((peerId: string) => void) | null = null;
  onPeerDisconnect: ((peerId: string) => void) | null = null;

  constructor(options: TransportManagerOptions) {
    this.roomId = options.roomId;
    this.options = {
      roomId: options.roomId,
      enableBroadcast: options.enableBroadcast ?? true,
      enableWebRTC: options.enableWebRTC ?? true,
      enableWebSocket: options.enableWebSocket ?? true,
      autoConnect: options.autoConnect ?? false,
      autoReconnect: options.autoReconnect ?? true,
    };
  }

  get state(): TransportState {
    return this._state;
  }

  get isConnected(): boolean {
    return this._state === "connected";
  }

  get peerCount(): number {
    // Use signaling transport's peer count (authoritative)
    return this.signalingTransport?.getPeerCount() ?? 0;
  }

  get myPeerId(): string | null {
    return this.signalingTransport?.getPeerId() ?? null;
  }

  async connect(): Promise<void> {
    if (this._state === "connected" || this._state === "connecting") {
      return;
    }

    this.setState("connecting");

    try {
      // Connect transports in parallel
      const connectPromises: Promise<void>[] = [];

      // BroadcastChannel (local tabs)
      if (this.options.enableBroadcast) {
        this.broadcastTransport = new BroadcastTransport();
        if (this.broadcastTransport.isSupported) {
          this.setupBroadcastCallbacks();
          connectPromises.push(this.broadcastTransport.connect(this.roomId));
        }
      }

      // Signaling (WebSocket + WebRTC)
      if (this.options.enableWebSocket || this.options.enableWebRTC) {
        this.signalingTransport = new SignalingTransport({
          enableWebRTC: this.options.enableWebRTC,
          autoReconnect: this.options.autoReconnect,
        });
        this.setupSignalingCallbacks();
        connectPromises.push(this.signalingTransport.connect(this.roomId));
      }

      await Promise.all(connectPromises);
      this.setState("connected");
    } catch (error) {
      this.setState("disconnected");
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];

    if (this.broadcastTransport) {
      disconnectPromises.push(this.broadcastTransport.disconnect());
    }
    if (this.signalingTransport) {
      disconnectPromises.push(this.signalingTransport.disconnect());
    }

    await Promise.all(disconnectPromises);

    this.broadcastTransport = null;
    this.signalingTransport = null;
    this.peers.clear();
    this.setState("disconnected");
  }

  private setupBroadcastCallbacks(): void {
    if (!this.broadcastTransport) return;

    this.broadcastTransport.onMessage = (msg) => {
      this.handleMessage(msg);
    };
  }

  private setupSignalingCallbacks(): void {
    if (!this.signalingTransport) return;

    this.signalingTransport.onMessage = (msg) => {
      this.handleMessage(msg);
    };

    this.signalingTransport.onStateChange = (state) => {
      // Propagate state changes
      if (state === "disconnected" && this._state === "connected") {
        this.setState("reconnecting");
      } else if (state === "connected" && this._state !== "connected") {
        this.setState("connected");
      }
    };

    this.signalingTransport.onPeerConnect = (peerId) => {
      this.addPeer(peerId);
      this.onPeerConnect?.(peerId);
    };

    this.signalingTransport.onPeerDisconnect = (peerId) => {
      this.removePeer(peerId);
      this.onPeerDisconnect?.(peerId);
    };
  }

  private handleMessage(msg: SyncMessage): void {
    // Deduplicate messages (same message may arrive via multiple transports)
    const msgId = getMessageId(msg.data);
    if (msgId && this.messageCache.has(msgId)) {
      return; // Already processed via faster transport
    }
    if (msgId) {
      this.messageCache.set(msgId, msg.receivedAt);
    }

    // Add time offset if not already set
    if (msg.source.transport !== "broadcast" && msg.source.peerId !== "ws-relay") {
      const offset = this.signalingTransport?.getPeerTimeOffset(msg.source.peerId) ?? 0;
      msg.source.timeOffset = offset;
    }

    this.onMessage?.(msg);
  }

  private addPeer(peerId: string): void {
    if (!this.peers.has(peerId)) {
      this.peers.set(peerId, {
        id: peerId,
        transports: new Set(["websocket"]),
        timeOffset: 0,
        lastSeen: Date.now(),
      });
    }
  }

  private removePeer(peerId: string): void {
    this.peers.delete(peerId);
  }

  /**
   * Broadcast data to all peers via all available transports.
   * Transports handle deduplication internally.
   */
  broadcast(data: ArrayBuffer | string): void {
    // Send to local tabs (instant)
    if (this.broadcastTransport?.state === "connected") {
      this.broadcastTransport.broadcast(data);
    }

    // Send to remote peers (signaling handles WebRTC vs WebSocket)
    if (this.signalingTransport?.state === "connected") {
      this.signalingTransport.broadcast(data);
    }
  }

  /**
   * Send data to a specific peer.
   */
  sendTo(peerId: string, data: ArrayBuffer | string): void {
    this.signalingTransport?.sendTo(peerId, data);
  }

  /**
   * Get time offset for a peer.
   */
  getTimeOffset(peerId: string): number {
    return this.signalingTransport?.getPeerTimeOffset(peerId) ?? 0;
  }

  /**
   * Set time offset for a peer.
   */
  setTimeOffset(peerId: string, offset: number): void {
    this.signalingTransport?.setPeerTimeOffset(peerId, offset);
  }

  /**
   * Get the BroadcastTransport's tab ID (for local tab sync messages).
   */
  getLocalTabId(): string | null {
    return this.broadcastTransport?.getTabId() ?? null;
  }

  private setState(state: TransportState): void {
    if (this._state !== state) {
      this._state = state;
      this.onStateChange?.(state);
    }
  }
}
