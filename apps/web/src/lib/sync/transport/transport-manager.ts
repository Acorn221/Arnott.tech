/**
 * TransportManager coordinates multiple transports for unified sync.
 *
 * Responsibilities:
 * - Manages transport lifecycle (connect/disconnect)
 * - Leader election (only one tab per device connects to signaling)
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
import { LeaderElection, type LeaderRole } from "./leader-election";

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
  private leaderElection: LeaderElection | null = null;
  private messageCache = new MessageCache();
  private peers = new Map<string, PeerInfo>();
  private roomId: string;
  private options: Required<TransportManagerOptions>;

  private _state: TransportState = "disconnected";
  private _leaderRole: LeaderRole = "unknown";

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
      enableLeaderElection: options.enableLeaderElection ?? true,
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

  get isLeader(): boolean {
    return this._leaderRole === "leader";
  }

  get leaderRole(): LeaderRole {
    return this._leaderRole;
  }

  async connect(): Promise<void> {
    if (this._state === "connected" || this._state === "connecting") {
      return;
    }

    this.setState("connecting");

    try {
      // 1. Always connect BroadcastChannel for local tab sync
      if (this.options.enableBroadcast) {
        this.broadcastTransport = new BroadcastTransport();
        if (this.broadcastTransport.isSupported) {
          this.setupBroadcastCallbacks();
          await this.broadcastTransport.connect(this.roomId);
        }
      }

      // 2. Run leader election (if enabled)
      if (this.options.enableLeaderElection && this.options.enableBroadcast) {
        this.leaderElection = new LeaderElection({ roomId: this.roomId });
        this.setupLeaderElectionCallbacks();
        await this.leaderElection.start();

        this._leaderRole = this.leaderElection.role;

        // 3. Only leader connects to signaling
        if (this.leaderElection.isLeader) {
          await this.connectSignaling();
        }
      } else {
        // No leader election - connect directly (legacy behavior)
        await this.connectSignaling();
      }

      this.setState("connected");
    } catch (error) {
      this.setState("disconnected");
      throw error;
    }
  }

  private async connectSignaling(): Promise<void> {
    if (this.options.enableWebSocket || this.options.enableWebRTC) {
      this.signalingTransport = new SignalingTransport({
        enableWebRTC: this.options.enableWebRTC,
        autoReconnect: this.options.autoReconnect,
      });
      this.setupSignalingCallbacks();
      await this.signalingTransport.connect(this.roomId);
    }
  }

  private async disconnectSignaling(): Promise<void> {
    if (this.signalingTransport) {
      await this.signalingTransport.disconnect();
      this.signalingTransport = null;
    }
  }

  async disconnect(): Promise<void> {
    // Stop leader election
    this.leaderElection?.stop();
    this.leaderElection = null;

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
    this._leaderRole = "unknown";
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
      // Handle message locally
      this.handleMessage(msg);

      // If leader, relay to followers
      if (this.leaderElection?.isLeader) {
        this.leaderElection.relayToFollowers(msg.source, msg.data as ArrayBuffer | string);
      }
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

  private setupLeaderElectionCallbacks(): void {
    if (!this.leaderElection) return;

    this.leaderElection.onBecomeLeader = () => {
      this._leaderRole = "leader";
      // Connect to signaling as the new leader
      void this.connectSignaling();
    };

    this.leaderElection.onBecomeFollower = () => {
      this._leaderRole = "follower";
      // Disconnect signaling if we had it (we're no longer leader)
      void this.disconnectSignaling();
    };

    this.leaderElection.onLeaderLost = () => {
      // Leader tab closed - re-election happening
      this.setState("reconnecting");
    };

    this.leaderElection.onRelayRequest = (data) => {
      // Follower wants to send to remote peers
      if (this.signalingTransport?.state === "connected") {
        this.signalingTransport.broadcast(data);
      }
    };

    this.leaderElection.onRelayBroadcast = (source, data) => {
      // Leader relayed a remote message to us
      const msg: SyncMessage = {
        data,
        source,
        receivedAt: performance.now(),
      };
      this.handleMessage(msg);
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
   * Broadcast data to all peers.
   * - Local tabs: via BroadcastChannel
   * - Remote peers: leader sends directly, follower relays through leader
   */
  broadcast(data: ArrayBuffer | string): void {
    // Send to local tabs (instant)
    if (this.broadcastTransport?.state === "connected") {
      this.broadcastTransport.broadcast(data);
    }

    // Send to remote peers
    if (this.leaderElection?.isLeader) {
      // Leader: send directly via signaling
      if (this.signalingTransport?.state === "connected") {
        this.signalingTransport.broadcast(data);
      }
    } else if (this.leaderElection?.isFollower) {
      // Follower: request leader to relay
      this.leaderElection.requestRelay(data);
    } else if (!this.options.enableLeaderElection) {
      // No leader election: send directly
      if (this.signalingTransport?.state === "connected") {
        this.signalingTransport.broadcast(data);
      }
    }
  }

  /**
   * Send data to a specific peer.
   */
  sendTo(peerId: string, data: ArrayBuffer | string): void {
    // Only works for leader (has direct signaling connection)
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
