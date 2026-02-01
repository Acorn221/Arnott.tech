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
import { SignalingTransport } from "./transports/signaling";
import type { ITransport } from "./interfaces/transport";
import { SYNC_ROOM_ID, type TransportType, type TransportState } from "./interfaces/types";
import { MAX_SEEN_MESSAGES, CLOCK_SYNC_INTERVAL_MS } from "./config";

const log = createLogger("sync:coordinator");

/** Pre-computed hex lookup table for fast byte-to-hex conversion */
const HEX_CHARS = "0123456789abcdef";

/** Coordinator connection state */
export type CoordinatorState = "disconnected" | "connecting" | "connected" | "reconnecting";

/** Options for SyncCoordinator */
export interface SyncCoordinatorOptions {
  /** Enable BroadcastChannel for local tabs (default: true) */
  enableBroadcast?: boolean;
  /** Enable WebRTC/WebSocket for remote sync when leader (default: true) */
  enableSignaling?: boolean;
  /** Signaling server URL (default: auto-detected) */
  signalingUrl?: string;
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
  private signalingTransport: SignalingTransport | null = null;

  // --- Message deduplication ---
  private seenMessages = new Set<string>();

  // --- State ---
  private _state: CoordinatorState = "disconnected";
  private options: {
    enableBroadcast: boolean;
    enableSignaling: boolean;
    signalingUrl: string | undefined;
    autoReconnect: boolean;
  };

  // --- Periodic sync ---
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  // --- App callbacks ---
  /** Message received (data, peerId, timeOffset) */
  onMessage: ((data: ArrayBuffer, peerId: string, timeOffset: number) => void) | null = null;
  /** State changed */
  onStateChange: ((state: CoordinatorState) => void) | null = null;
  /** New peer joined (for welcome effects, etc.) */
  onPeerJoin: ((peerId: string, isLocal: boolean) => void) | null = null;
  /** Transport status changed (e.g., WebRTC connected) */
  onTransportChange: (() => void) | null = null;

  constructor(options: SyncCoordinatorOptions = {}) {
    this.options = {
      enableBroadcast: options.enableBroadcast ?? true,
      enableSignaling: options.enableSignaling ?? true,
      signalingUrl: options.signalingUrl,
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

  /**
   * Check if any remote peer has a working WebRTC connection.
   * Returns true if at least one peer is connected via WebRTC P2P.
   */
  hasWebRTCConnection(): boolean {
    if (!this.signalingTransport) return false;

    // Check if any remote peer has WebRTC working
    for (const peer of this.registry.getAllPeers()) {
      if (!peer.isLocal && this.signalingTransport.hasPeerRTC(peer.id)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if signaling transport is connected (WebSocket to server).
   */
  hasSignalingConnection(): boolean {
    return this.signalingTransport?.state === "connected";
  }

  /**
   * Get counts of remote peers by transport type.
   */
  getRemoteTransportCounts(): { webrtc: number; websocket: number } {
    if (!this.signalingTransport) {
      return { webrtc: 0, websocket: 0 };
    }

    let webrtc = 0;
    let websocket = 0;

    for (const peer of this.registry.getAllPeers()) {
      if (!peer.isLocal) {
        if (this.signalingTransport.hasPeerRTC(peer.id)) {
          webrtc++;
        } else {
          websocket++;
        }
      }
    }

    return { webrtc, websocket };
  }

  // --- Connection lifecycle ---

  /**
   * Connect to sync.
   */
  async connect(): Promise<void> {
    if (this._state === "connected") {
      return;
    }

    this.setState("connecting");

    try {
      // Set up broadcast transport for local tab sync
      if (this.options.enableBroadcast) {
        this.broadcastTransport = new BroadcastTransport();
        this.wireTransport(this.broadcastTransport);
        await this.broadcastTransport.connect({});
        this.transports.set("broadcast", this.broadcastTransport);
      }

      // Connected for local tab sync immediately
      this.setState("connected");

      // Start periodic clock sync
      this.startPeriodicSync();

      // Start leader election (for remote sync)
      const tabId = this.broadcastTransport?.getLocalId() ?? `tab-${Date.now()}`;
      this.leader = new LeaderElection({ roomId: SYNC_ROOM_ID, tabId });
      this.leader.onBecomeLeader = () => {
        log.debug("Became leader");
        // Connect signaling for remote sync (only leader connects)
        if (this.options.enableSignaling) {
          void this.connectSignaling();
        }
      };
      this.leader.onBecomeFollower = (leaderId) => {
        log.debug("Became follower", { leaderId });
        // Disconnect signaling - only leader should be connected
        void this.disconnectSignaling();
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
    // Stop periodic sync
    this.stopPeriodicSync();

    this.leader?.stop();
    this.leader = null;

    for (const transport of this.transports.values()) {
      await transport.disconnect();
    }
    this.transports.clear();
    this.broadcastTransport = null;
    this.signalingTransport = null;

    this.registry.clear();
    this.timeSync.clear();
    this.seenMessages.clear();
    this.setState("disconnected");
  }

  /**
   * Connect to signaling server (called when becoming leader).
   */
  private async connectSignaling(): Promise<void> {
    if (this.signalingTransport) {
      return;
    }

    try {
      log.debug("Connecting signaling transport as leader");
      this.signalingTransport = new SignalingTransport();
      this.wireTransport(this.signalingTransport);
      await this.signalingTransport.connect({
        signalingUrl: this.options.signalingUrl,
        autoReconnect: this.options.autoReconnect,
      });
      this.transports.set("webrtc", this.signalingTransport);
      log.debug("Signaling transport connected");
    } catch (err) {
      log.error("Failed to connect signaling transport", { error: err });
      this.signalingTransport = null;
      // Don't throw - local sync via broadcast still works
    }
  }

  /**
   * Disconnect from signaling server (called when becoming follower).
   */
  private async disconnectSignaling(): Promise<void> {
    if (!this.signalingTransport) {
      return;
    }

    log.debug("Disconnecting signaling transport");
    this.transports.delete("webrtc");
    await this.signalingTransport.disconnect();
    this.signalingTransport = null;
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

    // Wire WebRTC change callback for SignalingTransport
    if (transport.type === "webrtc" && "onWebRTCChange" in transport) {
      (transport as SignalingTransport).onWebRTCChange = () => {
        this.onTransportChange?.();
      };
    }
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

    // Relay to other transports
    // Remote message (WebRTC) → relay to local tabs (Broadcast)
    // Local message (Broadcast) → relay to remote peers (WebRTC) if leader
    this.relayToOtherTransports(transportType, data);

    // Notify app
    const timeOffset = this.timeSync.getOffset(peerId);
    this.onMessage?.(data, peerId, timeOffset);
  }

  /**
   * Relay message to other transports.
   * - WebRTC message → relay to BroadcastChannel (local tabs)
   * - BroadcastChannel message → relay to WebRTC (remote peers) if leader
   */
  private relayToOtherTransports(sourceTransport: TransportType, data: ArrayBuffer): void {
    for (const [transportType, transport] of this.transports) {
      // Don't relay back to source transport
      if (transportType === sourceTransport) {
        continue;
      }

      // Only relay to connected transports
      if (transport.state !== "connected") {
        continue;
      }

      log.debug("Relaying message", { from: sourceTransport, to: transportType });
      transport.broadcast(data);
    }
  }

  /**
   * Handle time-sync message.
   */
  private handleTimeSyncMessage(peerId: string, data: ArrayBuffer): void {
    const result = this.timeSync.handleMessage(peerId, data);
    if (!result) return;

    // Update registry with new offset
    if (result.offset !== 0 || result.isNewPeer) {
      this.registry.setTimeOffset(peerId, result.offset);
    }

    // Send response if needed (for RTT-based sync)
    if (result.responseMessage) {
      this.sendTo(peerId, result.responseMessage);
      log.debug("Time sync response sent", { peerId });

      // Also send our own request if this is a new peer (for bidirectional sync)
      if (result.isNewPeer) {
        this.sendTimeSync(peerId);
      }
    }
  }

  /**
   * Send time-sync request to a peer.
   */
  private sendTimeSync(peerId: string): void {
    const data = this.timeSync.createSyncRequest(peerId);
    this.sendTo(peerId, data);
    log.debug("Time sync request sent", { peerId });
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
      // Notify app of new peer (for welcome effects)
      this.onPeerJoin?.(peerId, isLocal);
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
   * Uses direct hex conversion for performance (avoids Array.from/map/join overhead).
   */
  private getMessageId(data: ArrayBuffer): string {
    const view = new Uint8Array(data, 0, Math.min(16, data.byteLength));
    let result = "";
    for (const byte of view) {
      result += HEX_CHARS[byte >> 4] + HEX_CHARS[byte & 0x0f];
    }
    return result;
  }

  /**
   * Add message ID to seen set with LRU eviction.
   */
  private addSeenMessage(msgId: string): void {
    if (this.seenMessages.size >= MAX_SEEN_MESSAGES) {
      // Remove oldest (first) entry
      const first = this.seenMessages.values().next().value;
      if (first) this.seenMessages.delete(first);
    }
    this.seenMessages.add(msgId);
  }

  // --- Periodic clock sync ---

  /**
   * Start periodic clock synchronization with all peers.
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      this.syncAllPeers();
    }, CLOCK_SYNC_INTERVAL_MS);

    log.debug("Started periodic clock sync", { intervalMs: CLOCK_SYNC_INTERVAL_MS });
  }

  /**
   * Stop periodic clock synchronization.
   */
  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      log.debug("Stopped periodic clock sync");
    }
  }

  /**
   * Send time sync to all known peers.
   */
  private syncAllPeers(): void {
    const peers = this.registry.getAllPeers();
    if (peers.length === 0) return;

    log.debug("Periodic clock sync", { peerCount: peers.length });

    for (const peer of peers) {
      this.sendTimeSync(peer.id);
    }
  }
}
