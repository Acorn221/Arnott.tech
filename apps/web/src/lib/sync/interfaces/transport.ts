/**
 * ITransport - Clean interface for transport implementations.
 *
 * Transports are TRULY DUMB:
 * - They send and receive bytes
 * - They report peer reachability (not peer metadata)
 * - They do NOT track peer state, time offsets, or anything else
 *
 * All state management is handled by SyncCoordinator and PeerRegistry.
 */

import type { TransportType, TransportState, TransportConfig } from "./types";

/**
 * Transport interface - all transports implement this.
 *
 * Key design rules:
 * 1. Transport NEVER stores peer metadata
 * 2. Transport only knows "can I reach peer X?"
 * 3. Callbacks flow ONE direction: transport → coordinator
 * 4. Transport does NOT call back into coordinator except via callbacks
 */
export interface ITransport {
  /** Transport type identifier */
  readonly type: TransportType;

  /** Current connection state */
  readonly state: TransportState;

  /** Whether this transport is supported in current environment */
  readonly isSupported: boolean;

  /**
   * Connect to a room.
   * @param config - Connection configuration
   */
  connect(config: TransportConfig): Promise<void>;

  /**
   * Disconnect from current room.
   */
  disconnect(): Promise<void>;

  /**
   * Broadcast data to all peers reachable via this transport.
   * @param data - Binary data to send
   */
  broadcast(data: ArrayBuffer): void;

  /**
   * Send data to a specific peer.
   * @param peerId - Target peer ID
   * @param data - Binary data to send
   */
  send(peerId: string, data: ArrayBuffer): void;

  /**
   * Get this transport's local identifier.
   * For broadcast: tab ID
   * For signaling: peer ID assigned by server
   */
  getLocalId(): string;

  // --- Callbacks (set by coordinator) ---

  /**
   * Called when data is received from a peer.
   * Transport provides raw bytes only - no metadata.
   */
  onReceive: ((peerId: string, data: ArrayBuffer) => void) | null;

  /**
   * Called when a peer becomes reachable via this transport.
   * @param peerId - Peer that is now reachable
   * @param isLocal - Whether peer is local (same browser)
   */
  onPeerReachable: ((peerId: string, isLocal: boolean) => void) | null;

  /**
   * Called when a peer is no longer reachable via this transport.
   * @param peerId - Peer that is no longer reachable
   */
  onPeerUnreachable: ((peerId: string) => void) | null;

  /**
   * Called when transport state changes.
   */
  onStateChange: ((state: TransportState) => void) | null;
}
