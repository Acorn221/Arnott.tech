// Core types
export type { StateComputer, ConflictResolver } from "./types";

// Transport layer
export {
  TransportManager,
  BroadcastTransport,
  SignalingTransport,
  type Transport,
  type TransportState,
  type TransportType,
  type TransportManagerOptions,
  type SyncMessage,
  type MessageSource,
  type PeerInfo,
  type SignalingTransportOptions,
} from "./transport";

// Hooks
export {
  useSyncRoom,
  type UseSyncRoomOptions,
  type UseSyncRoomReturn,
} from "./hooks";

// Legacy - keep for now, can remove later
export {
  useBroadcastChannel,
  type UseBroadcastChannelOptions,
  type UseBroadcastChannelReturn,
} from "./useBroadcastChannel";
