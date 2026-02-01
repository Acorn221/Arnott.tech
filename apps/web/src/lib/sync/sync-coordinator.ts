/**
 * SyncCoordinator - Orchestrates sync transport layer.
 *
 * Responsibilities:
 * - Message deduplication
 * - Routes messages to best transport
 * - Delegates peer state to PeerRegistry
 * - Delegates time sync to TimeSyncManager
 * - Delegates leadership to LeaderElection
 *
 * Key design rules:
 * 1. ONE-WAY callback flow: transports → coordinator → app
 * 2. No callbacks going backwards (coordinator never calls transport callbacks)
 * 3. All state in delegated components (registry, timeSync, leader)
 * 4. Coordinator only orchestrates, doesn't track duplicate state
 */

import { createLogger } from "@arnott/logger";
import { PeerRegistry, type Peer } from "./peer-registry";
import { TimeSyncManager } from "./time-sync-manager";
import { LeaderElection } from "./leader-election";
import { BroadcastTransport } from "./transports/broadcast";
import type { ITransport } from "./interfaces/transport";
import type { TransportType, TransportState, TransportConfig } from "./interfaces/types";

const log = createLogger("sync:coordinator");

/** Coordinator connection state */
export type CoordinatorState = "disconnected" | "connecting" | "connected" | "reconnecting";

/** Options for SyncCoordinator */
export interface SyncCoordinatorOptions {
  /** Enable BroadcastChannel for local tabs (default: true) */
  enableBroadcast?: boolean;
  /** Enable WebRTC for P2P (default: false for now) */
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
 * await coordinator.connect("spinner");
 * coordinator.broadcast(encodedData);
 * ```
 */
export class SyncCoordinator {
  // --- Delegated components ---
  private registry = new PeerRegistry();
  private timeSync = new TimeSyncManager();
  private leader: LeaderElection | null = null;

  // --- Transports ---
  private transports = new Map<TransportType, ITransport>();
  private broadcastTransport: BroadcastTransport | null = null;

  // --- Message deduplication ---
  private seenMessages = new Set<string>();
  private readonly maxSeenMessages = 1000;

  // --- State ---
  private _state: CoordinatorState = "disconnected";
  private roomId: string | null = null;
  private options: Required<SyncCoordinatorOptions>;

  // --- App callbacks ---
  /** Message received (data, peerId, timeOffset) */
  onMessage: ((data: ArrayBuffer, peerId: string, timeOffset: number) => void) | null = null;
  /** State changed */
  onStateChange: ((state: CoordinatorState) => void) | null = null;

  constructor(options: SyncCoordinatorOptions = {}) {
    this.options = {
      enableBroadcast: options.enableBroadcast ?? true,
      enableWebRTC: options.enableWebRTC ?? false, // Disabled for now
      autoReconnect: options.autoReconnect ?? true,
    };
  }

  // --- Public getters ---

  get state(): CoordinatorState {
    return this._state;
  }

  get isConnected(): boolean {
    return this._state === "connected";
  }

  get isLeader(): boolean {
    return this.leader?.isLeader ?? false;
  }

  get peerCount(): number {
    return this.registry.size;
  }

  get peers(): Peer[] {
    return this.registry.getAllPeers();
  }

  getLocalId(): string {
    return this.broadcastTransport?.getLocalId() ?? "";
  }

  // --- Connection lifecycle ---

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
      // Set up broadcast transport for local tab sync
      if (this.options.enableBroadcast) {
        this.broadcastTransport = new BroadcastTransport();
        this.wireTransport(this.broadcastTransport);
        await this.broadcastTransport.connect({ roomId });
        this.transports.set("broadcast", this.broadcastTransport);
      }

      // Connected for local tab sync immediately
      this.setState("connected");

      // Start leader election (for future remote sync)
      const tabId = this.broadcastTransport?.getLocalId() ?? `tab-${Date.now()}`;
      this.leader = new LeaderElection({ roomId, tabId });
      this.leader.onBecomeLeader = () => {
        log.debug("Became leader");
        // Future: connect signaling for remote sync
      };
      this.leader.onBecomeFollower = (leaderId) => {
        log.debug("Became follower", { leaderId });
        // Future: disconnect signaling
      };
      void this.leader.start();

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
    this.leader?.stop();
    this.leader = null;

    for (const transport of this.transports.values()) {
      await transport.disconnect();
    }
    this.transports.clear();
    this.broadcastTransport = null;

    this.registry.clear();
    this.timeSync.clear();
    this.seenMessages.clear();
    this.roomId = null;
    this.setState("disconnected");
  }

  // --- Sending messages ---

  /**
   * Broadcast data to all peers.
   */
  broadcast(data: ArrayBuffer): void {
    if (this._state !== "connected") {
      return;
    }

    // Mark as seen to prevent receiving our own message
    const msgId = this.getMessageId(data);
    this.addSeenMessage(msgId);

    // Send via all connected transports
    for (const transport of this.transports.values()) {
      if (transport.state === "connected") {
        transport.broadcast(data);
      }
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

    // Get best transport to reach this peer
    const transportType = this.registry.getBestTransport(peerId);
    if (!transportType) {
      log.debug("sendTo: no transport for peer", { peerId });
      return;
    }

    const transport = this.transports.get(transportType);
    if (transport?.state === "connected") {
      transport.send(peerId, data);
    }
  }

  // --- Transport wiring ---

  /**
   * Wire a transport's callbacks to coordinator.
   */
  private wireTransport(transport: ITransport): void {
    const transportType = transport.type;

    transport.onReceive = (peerId, data) => {
      this.handleReceive(transportType, peerId, data);
    };

    transport.onPeerReachable = (peerId, isLocal) => {
      this.handlePeerReachable(transportType, peerId, isLocal);
    };

    transport.onPeerUnreachable = (peerId) => {
      this.handlePeerUnreachable(transportType, peerId);
    };

    transport.onStateChange = (state) => {
      this.handleTransportStateChange(transportType, state);
    };
  }

  // --- Incoming message handling ---

  /**
   * Handle data received from a transport.
   */
  private handleReceive(transportType: TransportType, peerId: string, data: ArrayBuffer): void {
    log.debug("handleReceive", { transportType, peerId, dataLength: data.byteLength });

    // Deduplication
    const msgId = this.getMessageId(data);
    if (this.seenMessages.has(msgId)) {
      log.debug("Message deduplicated", { msgId });
      return;
    }
    this.addSeenMessage(msgId);

    // Update peer last seen
    this.registry.touch(peerId);

    // Check if this is a time-sync message
    if (this.timeSync.isTimeSyncMessage(data)) {
      this.handleTimeSyncMessage(peerId, data);
      return; // Don't pass time-sync to app
    }

    // If peer has no time offset, send time-sync
    if (!this.timeSync.isReady(peerId)) {
      log.debug("Peer needs time-sync", { peerId });
      this.sendTimeSync(peerId);
    }

    // Relay to other transports if needed (future: for remote sync)
    // this.relayIfNeeded(transportType, peerId, data);

    // Notify app
    const timeOffset = this.timeSync.getOffset(peerId);
    this.onMessage?.(data, peerId, timeOffset);
  }

  /**
   * Handle time-sync message.
   */
  private handleTimeSyncMessage(peerId: string, data: ArrayBuffer): void {
    const result = this.timeSync.handleMessage(peerId, data);
    if (!result) return;

    // Update registry with new offset
    this.registry.setTimeOffset(peerId, result.offset);

    // Respond if needed (bidirectional sync)
    if (result.shouldRespond) {
      this.sendTimeSync(peerId);
    }
  }

  /**
   * Send time-sync to a peer.
   */
  private sendTimeSync(peerId: string): void {
    const data = this.timeSync.createSyncMessage();
    this.sendTo(peerId, data);
    log.debug("Time sync sent", { peerId });
  }

  // --- Peer discovery ---

  /**
   * Handle peer becoming reachable via a transport.
   */
  private handlePeerReachable(transportType: TransportType, peerId: string, isLocal: boolean): void {
    const result = this.registry.addTransport(peerId, transportType, isLocal);

    if (result.isNewPeer) {
      log.debug("New peer discovered", { peerId, transportType, isLocal });
      // Send time-sync to new peer
      this.sendTimeSync(peerId);
    }
  }

  /**
   * Handle peer no longer reachable via a transport.
   */
  private handlePeerUnreachable(transportType: TransportType, peerId: string): void {
    const result = this.registry.removeTransport(peerId, transportType);

    if (result.peerRemoved) {
      log.debug("Peer removed", { peerId });
      this.timeSync.removePeer(peerId);
    }
  }

  // --- Transport state changes ---

  /**
   * Handle transport state change.
   */
  private handleTransportStateChange(transportType: TransportType, state: TransportState): void {
    log.debug("Transport state changed", { transportType, state });

    // Update coordinator state based on transport states
    // For now, we're connected if broadcast is connected
    if (transportType === "broadcast") {
      if (state === "connected" && this._state === "connecting") {
        this.setState("connected");
      } else if (state === "disconnected" && this._state === "connected") {
        this.setState("reconnecting");
      }
    }
  }

  // --- State management ---

  private setState(state: CoordinatorState): void {
    if (this._state !== state) {
      log.debug("State change", { from: this._state, to: state });
      this._state = state;
      this.onStateChange?.(state);
    }
  }

  // --- Message ID for deduplication ---

  /**
   * Generate message ID from first 16 bytes.
   */
  private getMessageId(data: ArrayBuffer): string {
    const view = new Uint8Array(data.slice(0, 16));
    return Array.from(view)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Add message ID to seen set with LRU eviction.
   */
  private addSeenMessage(msgId: string): void {
    if (this.seenMessages.size >= this.maxSeenMessages) {
      // Remove oldest (first) entry
      const first = this.seenMessages.values().next().value;
      if (first) this.seenMessages.delete(first);
    }
    this.seenMessages.add(msgId);
  }
}
