/**
 * PeerRegistry - Single source of truth for all peer state.
 *
 * Tracks:
 * - Peer identity (unique ID)
 * - Available routes to reach peer (broadcast, webrtc, websocket)
 * - Time offset for clock sync
 * - Last seen timestamp
 * - Whether peer is local (same browser tab)
 */

import { createLogger } from "@arnott/logger";
import { type RouteType, getBestRoute } from "./transport/route";

const log = createLogger("sync:peers");

/**
 * Peer information tracked by registry.
 */
export interface Peer {
  /** Unique peer identifier */
  id: string;
  /** Routes that can reach this peer */
  routes: Set<RouteType>;
  /** Clock offset in ms (remote - local) */
  timeOffset: number;
  /** When we last heard from this peer (local time) */
  lastSeen: number;
  /** True if peer is in same browser (BroadcastChannel) */
  isLocal: boolean;
}

/**
 * PeerRegistry - manages all known peers.
 *
 * Routes report peer discovery/loss, coordinator handles time sync.
 * Single place for all peer state - no duplication.
 */
export class PeerRegistry {
  private peers = new Map<string, Peer>();

  // --- Callbacks ---
  onPeerJoin: ((peer: Peer) => void) | null = null;
  onPeerLeave: ((peerId: string) => void) | null = null;
  onPeerUpdate: ((peer: Peer) => void) | null = null;

  /**
   * Add a route to a peer.
   * Creates peer if it doesn't exist.
   */
  addRoute(peerId: string, route: RouteType, isLocal: boolean): void {
    let peer = this.peers.get(peerId);
    const isNew = !peer;

    if (!peer) {
      peer = {
        id: peerId,
        routes: new Set(),
        timeOffset: 0,
        lastSeen: performance.now(),
        isLocal,
      };
      this.peers.set(peerId, peer);
    }

    const hadRoute = peer.routes.has(route);
    peer.routes.add(route);
    peer.lastSeen = performance.now();

    // Update isLocal if this route indicates local peer
    if (isLocal) {
      peer.isLocal = true;
    }

    if (isNew) {
      log.debug("Peer joined", { peerId, route, isLocal });
      this.onPeerJoin?.(peer);
    } else if (!hadRoute) {
      log.debug("Peer route added", { peerId, route });
      this.onPeerUpdate?.(peer);
    }
  }

  /**
   * Remove a route from a peer.
   * Removes peer entirely if no routes remain.
   */
  removeRoute(peerId: string, route: RouteType): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    peer.routes.delete(route);

    if (peer.routes.size === 0) {
      log.debug("Peer left", { peerId });
      this.peers.delete(peerId);
      this.onPeerLeave?.(peerId);
    } else {
      log.debug("Peer route removed", { peerId, route, remaining: [...peer.routes] });
      this.onPeerUpdate?.(peer);
    }
  }

  /**
   * Set time offset for a peer.
   * Called by coordinator after time sync exchange.
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
   * Get the best route to reach a peer.
   */
  getBestRoute(peerId: string): RouteType | null {
    const peer = this.peers.get(peerId);
    if (!peer) return null;
    return getBestRoute(peer.routes);
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
    const peerIds = [...this.peers.keys()];
    this.peers.clear();
    for (const peerId of peerIds) {
      this.onPeerLeave?.(peerId);
    }
  }
}
