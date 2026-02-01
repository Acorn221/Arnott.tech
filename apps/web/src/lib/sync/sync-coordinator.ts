/**
 * SyncCoordinator - Orchestrates sync transport layer.
 *
 * Responsibilities:
 * - Message deduplication (single place)
 * - Automatic time-sync handling
 * - Routes messages to best transport
 * - Manages PeerRegistry
 * - Leader election for signaling connection
 * - Relay between local and remote routes
 */

import { createLogger } from "@arnott/logger";
import { PeerRegistry, type Peer } from "./peer-registry";
import { LeaderElection } from "./leader-election";
import { BroadcastRoute } from "./transport/broadcast-route";
import { SignalingRoute } from "./transport/signaling-route";
import type { Route, RouteType, RouteState } from "./transport/route";

const log = createLogger("sync:coordinator");

/** Time-sync message format (JSON) */
interface TimeSyncMessage {
  type: "time-sync";
  localTime: number;
}

/** Announce message for peer discovery */
interface AnnounceMessage {
  type: "announce";
  peerId: string;
}

/** Coordinator state */
export type CoordinatorState = "disconnected" | "connecting" | "connected" | "reconnecting";

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
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, timestamp);
  }

  clear(): void {
    this.cache.clear();
  }
}

/** Generate message ID for deduplication (first 16 bytes) */
function getMessageId(data: ArrayBuffer): string {
  const view = new Uint8Array(data.slice(0, 16));
  return Array.from(view)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface SyncCoordinatorOptions {
  /** Enable BroadcastChannel for local tabs (default: true) */
  enableBroadcast?: boolean;
  /** Enable WebRTC for P2P (default: true) */
  enableWebRTC?: boolean;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
}

/**
 * SyncCoordinator - unified sync interface.
 *
 * Usage:
 * ```ts
 * const coordinator = new SyncCoordinator();
 * coordinator.onMessage = (data, peerId, timeOffset) => { ... };
 * coordinator.onPeerJoin = (peerId) => { ... };
 * await coordinator.connect("spinner");
 * coordinator.broadcast(encodedData);
 * ```
 */
export class SyncCoordinator {
  private registry = new PeerRegistry();
  private leaderElection: LeaderElection | null = null;
  private broadcastRoute: BroadcastRoute | null = null;
  private signalingRoute: SignalingRoute | null = null;
  private messageDedup = new MessageCache();

  private _state: CoordinatorState = "disconnected";
  private roomId: string | null = null;
  private options: Required<SyncCoordinatorOptions>;

  // --- Callbacks ---
  /** Message received (data, peerId, timeOffset) */
  onMessage: ((data: ArrayBuffer, peerId: string, timeOffset: number) => void) | null = null;
  /** Peer joined */
  onPeerJoin: ((peerId: string) => void) | null = null;
  /** Peer left */
  onPeerLeave: ((peerId: string) => void) | null = null;
  /** State changed */
  onStateChange: ((state: CoordinatorState) => void) | null = null;

  constructor(options: SyncCoordinatorOptions = {}) {
    this.options = {
      enableBroadcast: options.enableBroadcast ?? true,
      enableWebRTC: options.enableWebRTC ?? true,
      autoReconnect: options.autoReconnect ?? true,
    };

    // Wire up registry events
    // Defer onPeerJoin to next microtask so time-sync is sent first
    // (sendTimeSync is called in wireRoute immediately after addRoute)
    this.registry.onPeerJoin = (peer) => {
      queueMicrotask(() => this.onPeerJoin?.(peer.id));
    };
    this.registry.onPeerLeave = (peerId) => this.onPeerLeave?.(peerId);
  }

  get state(): CoordinatorState {
    return this._state;
  }

  get isConnected(): boolean {
    return this._state === "connected";
  }

  /** Whether this tab is the leader (owns signaling connection) */
  get isLeader(): boolean {
    return this.leaderElection?.isLeader ?? false;
  }

  /** Get count of known peers */
  get peerCount(): number {
    return this.registry.size;
  }

  /**
   * Connect to a sync room.
   */
  async connect(roomId: string): Promise<void> {
    if (this._state === "connected" && this.roomId === roomId) {
      return;
    }

    this.roomId = roomId;
    this.setState("connecting");

    try {
      // 1. Set up broadcast route for local tab sync
      if (this.options.enableBroadcast) {
        this.broadcastRoute = new BroadcastRoute();
        this.wireRoute(this.broadcastRoute);
        await this.broadcastRoute.connect(roomId);
      }

      // Connected for local tab sync immediately
      // (leader election determines WHO connects to signaling, but local sync works now)
      this.setState("connected");

      // Announce ourselves so other tabs know we exist and can send their state
      this.broadcastAnnounce();

      // 2. Start leader election (async - doesn't block connected state)
      const tabId = this.broadcastRoute?.getLocalId() ?? `tab-${Date.now()}`;
      this.leaderElection = new LeaderElection({ roomId, tabId });

      this.leaderElection.onBecomeLeader = () => {
        log.debug("Became leader, connecting signaling");
        void this.connectSignaling();
      };

      this.leaderElection.onBecomeFollower = (leaderId) => {
        log.debug("Became follower", { leaderId });
        void this.disconnectSignaling();
      };

      this.leaderElection.onLeaderLost = () => {
        log.debug("Leader lost, will attempt takeover");
      };

      // Don't await - let leader election happen in background
      void this.leaderElection.start();
    } catch (err) {
      log.error("Failed to connect", { error: err });
      this.setState("disconnected");
      throw err;
    }
  }

  /**
   * Disconnect from the room.
   */
  async disconnect(): Promise<void> {
    this.leaderElection?.stop();
    this.leaderElection = null;

    await this.disconnectSignaling();

    if (this.broadcastRoute) {
      await this.broadcastRoute.disconnect();
      this.broadcastRoute = null;
    }

    this.registry.clear();
    this.messageDedup.clear();
    this.roomId = null;
    this.setState("disconnected");
  }

  /**
   * Broadcast data to all peers.
   */
  broadcast(data: ArrayBuffer): void {
    if (this._state !== "connected") {
      return;
    }

    // Mark as seen to prevent receiving our own message
    const msgId = getMessageId(data);
    this.messageDedup.set(msgId, performance.now());

    // Send via broadcast route (local tabs)
    if (this.broadcastRoute?.state === "connected") {
      this.broadcastRoute.send("all", data);
    }

    // Leader also sends via signaling (remote peers)
    if (this.isLeader && this.signalingRoute?.state === "connected") {
      this.signalingRoute.send("all", data);
    }
  }

  /**
   * Send data to a specific peer.
   */
  sendTo(peerId: string, data: ArrayBuffer): void {
    if (this._state !== "connected") {
      return;
    }

    const peer = this.registry.getPeer(peerId);
    if (!peer) {
      log.debug("sendTo: peer not found", { peerId });
      return;
    }

    // Check if peer is reachable via broadcast (local tab)
    if (peer.isLocal && this.broadcastRoute?.state === "connected") {
      // BroadcastChannel doesn't support targeted send, but we can
      // include target in message envelope if needed
      this.broadcastRoute.send(peerId, data);
      return;
    }

    // Remote peer - only leader can send
    if (this.isLeader && this.signalingRoute?.state === "connected") {
      this.signalingRoute.send(peerId, data);
    }
  }

  /**
   * Connect the signaling route (leader only).
   */
  private async connectSignaling(): Promise<void> {
    if (this.signalingRoute) return;
    if (!this.roomId) return;

    this.signalingRoute = new SignalingRoute({
      enableWebRTC: this.options.enableWebRTC,
      autoReconnect: this.options.autoReconnect,
    });

    this.wireRoute(this.signalingRoute);

    this.signalingRoute.onStateChange = (state) => {
      if (state === "disconnected" && this._state === "connected") {
        this.setState("reconnecting");
      } else if (state === "connected" && this._state === "reconnecting") {
        this.setState("connected");
      }
    };

    await this.signalingRoute.connect(this.roomId);
  }

  /**
   * Disconnect the signaling route.
   */
  private async disconnectSignaling(): Promise<void> {
    if (this.signalingRoute) {
      await this.signalingRoute.disconnect();
      this.signalingRoute = null;
    }
  }

  /**
   * Wire a route's callbacks.
   */
  private wireRoute(route: Route): void {
    const routeType = route.type;
    const isLocal = routeType === "broadcast";

    route.onRawMessage = (peerId, data) => {
      this.handleRawMessage(routeType, peerId, data, isLocal);
    };

    route.onPeerDiscovered = (peerId, peerIsLocal) => {
      this.registry.addRoute(peerId, routeType, peerIsLocal);

      // Send time-sync to new peers
      // Local tabs need time-sync too because each has different performance.now() origin
      // (e.g., if Tab A has been open 5 minutes and Tab B just refreshed)
      this.sendTimeSync(peerId);
    };

    route.onPeerLost = (peerId) => {
      this.registry.removeRoute(peerId, routeType);
    };
  }

  /**
   * Handle incoming message from any route.
   */
  private handleRawMessage(
    routeType: RouteType,
    peerId: string,
    data: ArrayBuffer,
    isLocal: boolean
  ): void {
    log.debug("handleRawMessage", { routeType, peerId, isLocal, dataLength: data.byteLength });

    // Deduplication - same message may arrive via multiple paths
    const msgId = getMessageId(data);
    if (this.messageDedup.has(msgId)) {
      log.debug("Message deduplicated", { msgId });
      return;
    }
    this.messageDedup.set(msgId, performance.now());

    // Update peer registry
    this.registry.touch(peerId);

    // Check if this is an internal message (time-sync or announce)
    if (this.isInternalMessage(data)) {
      this.handleInternalMessage(peerId, data);
      return; // Don't pass internal messages to app
    }

    // If we receive a message from a peer with no time offset established,
    // send time-sync immediately to establish clock sync
    // (applies to both local and remote peers - each tab has different performance.now() origin)
    const offset = this.registry.getTimeOffset(peerId);
    if (offset === 0) {
      log.debug("No time offset for peer, sending time-sync", { peerId });
      this.sendTimeSync(peerId);
    }

    // Relay if needed
    this.relayIfNeeded(routeType, peerId, data);

    // Notify app
    const timeOffset = this.registry.getTimeOffset(peerId);
    log.debug("Notifying app", { peerId, timeOffset, hasCallback: !!this.onMessage });
    this.onMessage?.(data, peerId, timeOffset);
  }

  /**
   * Check if data is an internal message (time-sync or announce).
   */
  private isInternalMessage(data: ArrayBuffer): boolean {
    if (data.byteLength > 100) return false;

    try {
      const text = new TextDecoder().decode(data);
      const msg = JSON.parse(text);
      return msg?.type === "time-sync" || msg?.type === "announce";
    } catch {
      return false;
    }
  }

  /**
   * Handle internal messages (time-sync, announce).
   */
  private handleInternalMessage(peerId: string, data: ArrayBuffer): void {
    try {
      const text = new TextDecoder().decode(data);
      const msg = JSON.parse(text);

      if (msg.type === "time-sync") {
        this.handleTimeSyncMessage(peerId, msg as TimeSyncMessage);
      } else if (msg.type === "announce") {
        this.handleAnnounce(peerId);
      }
    } catch (err) {
      log.debug("Failed to parse internal message", { error: err });
    }
  }

  /**
   * Handle announce message - a new peer has joined.
   */
  private handleAnnounce(peerId: string): void {
    log.debug("Peer announced", { peerId });
    // The peer is already discovered via onPeerDiscovered
    // This just ensures onPeerJoin is called so app can send state
  }

  /**
   * Broadcast announce to let other tabs know we exist.
   */
  private broadcastAnnounce(): void {
    if (!this.broadcastRoute || this.broadcastRoute.state !== "connected") {
      return;
    }

    const myId = this.broadcastRoute.getLocalId();
    const msg: AnnounceMessage = {
      type: "announce",
      peerId: myId,
    };

    const data = new TextEncoder().encode(JSON.stringify(msg));
    this.broadcastRoute.send("all", data.buffer as ArrayBuffer);
    log.debug("Broadcast announce", { peerId: myId });
  }

  /**
   * Handle time-sync message (already parsed).
   */
  private handleTimeSyncMessage(peerId: string, msg: TimeSyncMessage): void {
    const oldOffset = this.registry.getTimeOffset(peerId);
    const offset = performance.now() - msg.localTime;
    this.registry.setTimeOffset(peerId, offset);
    log.debug("Time sync received", { peerId, offset });

    // Respond with our own time-sync if we haven't sent one yet
    // (detected by their offset for us being 0, meaning we need to send ours)
    // All tabs need to do bidirectional time-sync for local tab communication
    if (oldOffset === 0) {
      this.sendTimeSync(peerId);
    }
  }

  /**
   * Send time-sync to a peer.
   */
  private sendTimeSync(peerId: string): void {
    const msg: TimeSyncMessage = {
      type: "time-sync",
      localTime: performance.now(),
    };

    const data = new TextEncoder().encode(JSON.stringify(msg));
    this.sendTo(peerId, data.buffer as ArrayBuffer);
    log.debug("Time sync sent", { peerId });
  }

  /**
   * Relay message between routes if needed.
   */
  private relayIfNeeded(sourceRoute: RouteType, peerId: string, data: ArrayBuffer): void {
    // Only leader relays
    if (!this.isLeader) return;

    if (sourceRoute === "broadcast") {
      // Local → Remote: relay to signaling
      if (this.signalingRoute?.state === "connected") {
        log.debug("Relaying local→remote", { from: peerId });
        this.signalingRoute.send("all", data);
      }
    } else {
      // Remote → Local: relay to broadcast
      if (this.broadcastRoute?.state === "connected") {
        log.debug("Relaying remote→local", { from: peerId });
        this.broadcastRoute.send("all", data);
      }
    }
  }

  private setState(state: CoordinatorState): void {
    if (this._state !== state) {
      log.debug("State change", { from: this._state, to: state, hasCallback: !!this.onStateChange });
      this._state = state;
      this.onStateChange?.(state);
    }
  }
}
