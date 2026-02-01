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
    this.registry.onPeerJoin = (peer) => this.onPeerJoin?.(peer.id);
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

      // 2. Start leader election
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

      await this.leaderElection.start();

      this.setState("connected");
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

      // Send time-sync to new remote peers (leader only)
      if (!peerIsLocal && this.isLeader) {
        this.sendTimeSync(peerId);
      }
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
    // Deduplication - same message may arrive via multiple paths
    const msgId = getMessageId(data);
    if (this.messageDedup.has(msgId)) {
      return;
    }
    this.messageDedup.set(msgId, performance.now());

    // Update peer registry
    this.registry.touch(peerId);

    // Check if this is a time-sync message (JSON)
    if (this.isTimeSyncMessage(data)) {
      this.handleTimeSync(peerId, data);
      return; // Don't pass time-sync to app
    }

    // Relay if needed
    this.relayIfNeeded(routeType, peerId, data);

    // Notify app
    const timeOffset = this.registry.getTimeOffset(peerId);
    this.onMessage?.(data, peerId, timeOffset);
  }

  /**
   * Check if data is a time-sync message.
   */
  private isTimeSyncMessage(data: ArrayBuffer): boolean {
    // Time-sync messages are small JSON
    if (data.byteLength > 100) return false;

    try {
      const text = new TextDecoder().decode(data);
      const msg = JSON.parse(text);
      return msg?.type === "time-sync";
    } catch {
      return false;
    }
  }

  /**
   * Handle time-sync message.
   */
  private handleTimeSync(peerId: string, data: ArrayBuffer): void {
    try {
      const text = new TextDecoder().decode(data);
      const msg = JSON.parse(text) as TimeSyncMessage;

      if (msg.type === "time-sync") {
        const offset = performance.now() - msg.localTime;
        this.registry.setTimeOffset(peerId, offset);
        log.debug("Time sync received", { peerId, offset });
      }
    } catch (err) {
      log.debug("Failed to parse time-sync", { error: err });
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
      this._state = state;
      this.onStateChange?.(state);
    }
  }
}
