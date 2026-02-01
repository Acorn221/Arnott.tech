/**
 * PeerRegistry - Single source of truth for all peer state.
 *
 * This is a PURE DATA STORE with no side effects:
 * - NO callbacks that trigger coordinator actions
 * - Mutations return results so coordinator can decide what to do
 * - Optional onChange callback for UI updates only
 *
 * Tracks per peer:
 * - ID (unique identifier)
 * - Available transports
 * - Time offset for clock sync
 * - Last seen timestamp
 * - Whether peer is local (same browser)
 */

import { createLogger } from "@arnott/logger";
import { type TransportType, type Peer, getBestTransport } from "./interfaces/types";

const log = createLogger("sync:peers");

/** Result of adding a transport to a peer */
export interface AddTransportResult {
  /** The peer object */
  peer: Peer;
  /** Whether this is a brand new peer (not seen before) */
  isNewPeer: boolean;
  /** Whether this transport was newly added (peer existed but didn't have this transport) */
  isNewTransport: boolean;
}

/** Result of removing a transport from a peer */
export interface RemoveTransportResult {
  /** The peer object, or null if peer was removed entirely */
  peer: Peer | null;
  /** Whether the peer was removed (no transports remaining) */
  peerRemoved: boolean;
}

/**
 * PeerRegistry - manages all known peers.
 *
 * Key design rules:
 * 1. NEVER calls back into coordinator (no cascading updates)
 * 2. Mutations return results, coordinator decides what to do
 * 3. Optional onChange for UI updates only (debounced, batched)
 *
 * Usage:
 * ```ts
 * const registry = new PeerRegistry();
 *
 * // Add transport - coordinator checks result
 * const result = registry.addTransport(peerId, "broadcast", true);
 * if (result.isNewPeer) {
 *   // Send initial sync, etc.
 * }
 *
 * // Remove transport - coordinator checks result
 * const removed = registry.removeTransport(peerId, "broadcast");
 * if (removed.peerRemoved) {
 *   // Clean up, etc.
 * }
 *
 * // Query
 * const peer = registry.getPeer(peerId);
 * const allPeers = registry.getAllPeers();
 * const bestTransport = registry.getBestTransport(peerId);
 * ```
 */
export class PeerRegistry {
  private peers = new Map<string, Peer>();

  /**
   * Optional callback for UI updates.
   * Called after any mutation. Should NOT trigger coordinator actions.
   * Intended for React state updates, etc.
   */
  onChange: ((peers: Peer[]) => void) | null = null;

  /**
   * Add a transport route to a peer.
   * Creates peer if it doesn't exist.
   *
   * @returns Result with peer and flags indicating what changed
   */
  addTransport(peerId: string, transport: TransportType, isLocal: boolean): AddTransportResult {
    let peer = this.peers.get(peerId);
    const isNewPeer = !peer;

    if (!peer) {
      peer = {
        id: peerId,
        transports: new Set(),
        timeOffset: 0,
        lastSeen: performance.now(),
        isLocal,
      };
      this.peers.set(peerId, peer);
    }

    const isNewTransport = !peer.transports.has(transport);
    peer.transports.add(transport);
    peer.lastSeen = performance.now();

    // Update isLocal if this transport indicates local peer
    if (isLocal) {
      peer.isLocal = true;
    }

    if (isNewPeer) {
      log.debug("Peer joined", { peerId, transport, isLocal });
    } else if (isNewTransport) {
      log.debug("Peer transport added", { peerId, transport });
    }

    this.notifyChange();

    return { peer, isNewPeer, isNewTransport };
  }

  /**
   * Remove a transport route from a peer.
   * Removes peer entirely if no transports remain.
   *
   * @returns Result with peer (null if removed) and flag
   */
  removeTransport(peerId: string, transport: TransportType): RemoveTransportResult {
    const peer = this.peers.get(peerId);
    if (!peer) {
      return { peer: null, peerRemoved: false };
    }

    peer.transports.delete(transport);

    if (peer.transports.size === 0) {
      log.debug("Peer left", { peerId });
      this.peers.delete(peerId);
      this.notifyChange();
      return { peer: null, peerRemoved: true };
    }

    log.debug("Peer transport removed", { peerId, transport, remaining: [...peer.transports] });
    this.notifyChange();
    return { peer, peerRemoved: false };
  }

  /**
   * Set time offset for a peer.
   */
  setTimeOffset(peerId: string, offset: number): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.timeOffset = offset;
      log.debug("Peer time offset set", { peerId, offset });
    }
  }

  /**
   * Get time offset for a peer.
   */
  getTimeOffset(peerId: string): number {
    return this.peers.get(peerId)?.timeOffset ?? 0;
  }

  /**
   * Update last seen timestamp for a peer.
   */
  touch(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.lastSeen = performance.now();
    }
  }

  /**
   * Get a peer by ID.
   */
  getPeer(peerId: string): Peer | undefined {
    return this.peers.get(peerId);
  }

  /**
   * Get all known peers.
   */
  getAllPeers(): Peer[] {
    return [...this.peers.values()];
  }

  /**
   * Get the best transport to reach a peer.
   */
  getBestTransport(peerId: string): TransportType | null {
    const peer = this.peers.get(peerId);
    if (!peer) return null;
    return getBestTransport(peer.transports);
  }

  /**
   * Check if a peer exists.
   */
  hasPeer(peerId: string): boolean {
    return this.peers.has(peerId);
  }

  /**
   * Get count of known peers.
   */
  get size(): number {
    return this.peers.size;
  }

  /**
   * Clear all peers.
   */
  clear(): void {
    this.peers.clear();
    this.notifyChange();
  }

  /**
   * Notify onChange callback if set.
   */
  private notifyChange(): void {
    this.onChange?.(this.getAllPeers());
  }
}

// Re-export Peer type for convenience
export type { Peer };
