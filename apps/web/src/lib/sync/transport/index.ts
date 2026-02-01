// Types
export type {
  Transport,
  TransportState,
  TransportType,
  TransportConfig,
  SyncMessage,
  MessageSource,
  PeerInfo,
} from "./types";

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
export { FallbackCoordinator } from "./fallback-coordinator";
