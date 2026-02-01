/**
 * Core type definitions for sync system.
 *
 * These types are used across all sync components.
 */

/**
 * Transport types in order of preference (lower latency = better)
 */
export type TransportType = "broadcast" | "webrtc" | "websocket";

/**
 * Transport connection states
 */
export type TransportState = "disconnected" | "connecting" | "connected";

/**
 * Transport priority for selecting best path to peer.
 * Lower = better (faster/more direct)
 */
export const TRANSPORT_PRIORITY: Record<TransportType, number> = {
  broadcast: 0, // Local tab, ~1ms
  webrtc: 1, // P2P, ~50ms
  websocket: 2, // Server relay, ~100ms
};

/**
 * Peer information stored in registry.
 */
export interface Peer {
  /** Unique peer identifier */
  id: string;

  /** Whether peer is in same browser (reachable via BroadcastChannel) */
  isLocal: boolean;

  /** Available transports to reach this peer */
  transports: Set<TransportType>;

  /** Clock offset in ms (peer time - local time) */
  timeOffset: number;

  /** When we last heard from this peer (local performance.now()) */
  lastSeen: number;
}

/**
 * Configuration for transport connection.
 */
export interface TransportConfig {
  /** Room ID to connect to */
  roomId: string;

  /** Optional signaling server URL (for WebRTC/WebSocket) */
  signalingUrl?: string;

  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
}

/**
 * Get the best transport from a set of available transports.
 */
export function getBestTransport(transports: Set<TransportType>): TransportType | null {
  let best: TransportType | null = null;
  let bestPriority = Infinity;

  for (const transport of transports) {
    const priority = TRANSPORT_PRIORITY[transport];
    if (priority < bestPriority) {
      best = transport;
      bestPriority = priority;
    }
  }

  return best;
}
