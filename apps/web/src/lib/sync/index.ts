// Core types
export type { StateComputer, ConflictResolver } from "./types";

// Transport layer
export {
  TransportFacade,
  BroadcastTransport,
  SignalingTransport,
  WorkerTransport,
  FallbackCoordinator,
  type Transport,
  type TransportState,
  type TransportType,
  type TransportFacadeOptions,
  type SyncMessage,
  type MessageSource,
  type PeerInfo,
  type SignalingTransportOptions,
  type TabToWorkerMessage,
  type WorkerToTabMessage,
  type WorkerState,
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
