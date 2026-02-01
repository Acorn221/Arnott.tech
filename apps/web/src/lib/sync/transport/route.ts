/**
 * Route abstraction for sync transport layer.
 *
 * Routes are pure I/O - they send and receive bytes, nothing more.
 * Peer state tracking, deduplication, and time sync are handled by SyncCoordinator.
 */

/**
 * Route types in order of preference (lower latency = better)
 */
export type RouteType = "broadcast" | "webrtc" | "websocket";

/**
 * Route connection states
 */
export type RouteState = "disconnected" | "connecting" | "connected" | "reconnecting";

/**
 * Core route interface - all routes implement this.
 *
 * Key differences from old Transport interface:
 * - No SyncMessage wrapper - just raw bytes + peerId
 * - No time offset tracking - that's PeerRegistry's job
 * - No broadcast() vs sendTo() - just send(target, data)
 * - Peer discovery reports to coordinator, not app
 */
export interface Route {
  /** Route type identifier */
  readonly type: RouteType;

  /** Current connection state */
  readonly state: RouteState;

  /** Whether this route is supported in current environment */
  readonly isSupported: boolean;

  /** Connect to a room */
  connect(roomId: string): Promise<void>;

  /** Disconnect from current room */
  disconnect(): Promise<void>;

  /**
   * Send data to a target.
   * @param target - Peer ID or "all" for broadcast
   * @param data - Binary data to send
   */
  send(target: string | "all", data: ArrayBuffer): void;

  /**
   * Get this route's local identifier (tab ID for broadcast, peer ID for signaling)
   */
  getLocalId(): string | null;

  // --- Callbacks (set by coordinator) ---

  /**
   * Raw message received.
   * Called with sender's peer ID and raw bytes.
   * Coordinator handles dedup and routing.
   */
  onRawMessage: ((peerId: string, data: ArrayBuffer) => void) | null;

  /**
   * Peer discovered via this route.
   * Coordinator registers in PeerRegistry.
   */
  onPeerDiscovered: ((peerId: string, isLocal: boolean) => void) | null;

  /**
   * Peer lost via this route.
   * Coordinator updates PeerRegistry.
   */
  onPeerLost: ((peerId: string) => void) | null;

  /**
   * Route state changed.
   */
  onStateChange: ((state: RouteState) => void) | null;
}

/**
 * Route priority for selecting best path to peer.
 * Lower = better (faster/more direct)
 */
export const ROUTE_PRIORITY: Record<RouteType, number> = {
  broadcast: 0, // Local tab, ~1ms
  webrtc: 1, // P2P, ~50ms
  websocket: 2, // Server relay, ~100ms
};

/**
 * Get the best route from a set of available routes.
 */
export function getBestRoute(routes: Set<RouteType>): RouteType | null {
  let best: RouteType | null = null;
  let bestPriority = Infinity;

  for (const route of routes) {
    const priority = ROUTE_PRIORITY[route];
    if (priority < bestPriority) {
      best = route;
      bestPriority = priority;
    }
  }

  return best;
}
