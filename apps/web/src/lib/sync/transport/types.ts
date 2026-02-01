/**
 * Transport abstraction types for unified sync interface.
 */

/**
 * Transport connection states
 */
export type TransportState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

/**
 * Transport types in order of preference (lower = faster/preferred)
 */
export type TransportType = "broadcast" | "webrtc" | "websocket";

/**
 * Message source information
 */
export interface MessageSource {
  /** Which transport delivered this message */
  transport: TransportType;
  /** Unique peer identifier */
  peerId: string;
  /** True if from same browser (BroadcastChannel) */
  isLocalTab: boolean;
  /** Clock offset in ms (remote - local) */
  timeOffset: number;
}

/**
 * Wrapper around message data with source metadata
 */
export interface SyncMessage<T = unknown> {
  /** The actual message data */
  data: T;
  /** Where this message came from */
  source: MessageSource;
  /** Local timestamp when received */
  receivedAt: number;
}

/**
 * Peer information tracked by transport manager
 */
export interface PeerInfo {
  id: string;
  /** Which transports can reach this peer */
  transports: Set<TransportType>;
  /** Clock offset for this peer */
  timeOffset: number;
  /** When we last heard from this peer */
  lastSeen: number;
}

/**
 * Core transport interface - all transports implement this
 */
export interface Transport {
  /** Transport identifier */
  readonly name: TransportType;

  /** Current connection state */
  readonly state: TransportState;

  /** Whether this transport is supported in current environment */
  readonly isSupported: boolean;

  /** Connect to a room */
  connect(roomId: string): Promise<void>;

  /** Disconnect from current room */
  disconnect(): Promise<void>;

  /** Broadcast data to all peers via this transport */
  broadcast(data: ArrayBuffer | string): void;

  /** Send to specific peer (optional - not all transports support this) */
  sendTo?(peerId: string, data: ArrayBuffer | string): void;

  /** Message received callback */
  onMessage: ((message: SyncMessage) => void) | null;

  /** Connection state changed callback */
  onStateChange: ((state: TransportState) => void) | null;

  /** New peer connected callback */
  onPeerConnect: ((peerId: string) => void) | null;

  /** Peer disconnected callback */
  onPeerDisconnect: ((peerId: string) => void) | null;
}

/**
 * Transport configuration
 */
export interface TransportConfig {
  roomId: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectBackoff?: {
    initial: number;
    max: number;
    multiplier: number;
  };
}

/**
 * Transport manager options
 */
export interface TransportManagerOptions {
  roomId: string;
  /** Enable BroadcastChannel for same-browser tabs (default: true) */
  enableBroadcast?: boolean;
  /** Enable WebRTC for P2P connections (default: true) */
  enableWebRTC?: boolean;
  /** Enable WebSocket as fallback relay (default: true) */
  enableWebSocket?: boolean;
  /** Auto-connect on creation (default: false) */
  autoConnect?: boolean;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
}
