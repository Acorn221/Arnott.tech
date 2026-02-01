// Types
export type {
  Transport,
  TransportState,
  TransportType,
  TransportConfig,
  TransportManagerOptions,
  SyncMessage,
  MessageSource,
  PeerInfo,
} from "./types";

export type {
  TabToWorkerMessage,
  WorkerToTabMessage,
  WorkerState,
} from "./worker-types";

// Main facade (use this)
export {
  TransportFacade,
  type TransportFacadeOptions,
} from "./transport-facade";

// Individual transports (for advanced use)
export { BroadcastTransport } from "./broadcast-transport";
export {
  SignalingTransport,
  type SignalingTransportOptions,
} from "./signaling-transport";
export { WorkerTransport } from "./worker-transport";
export { FallbackCoordinator } from "./fallback-coordinator";
