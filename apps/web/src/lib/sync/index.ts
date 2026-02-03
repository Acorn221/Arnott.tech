// Core types
export type { ConflictResolver,StateComputer } from "./types";

// Interfaces
export type { ITransport } from "./interfaces/transport";
export type {
  Peer,
  TransportConfig,
  TransportState,
  TransportType,
} from "./interfaces/types";
export { getBestTransport, SYNC_ROOM_ID,TRANSPORT_PRIORITY } from "./interfaces/types";

// Coordinator
export {
  type CoordinatorState,
  SyncCoordinator,
  type SyncCoordinatorOptions,
} from "./sync-coordinator";

// Registry
export { type AddTransportResult, PeerRegistry, type RemoveTransportResult } from "./peer-registry";

// Time Sync
export {
  TimeSyncManager,
  type TimeSyncMessage,
  type TimeSyncRequest,
  type TimeSyncResponse,
  type TimeSyncResult,
} from "./time-sync-manager";

// Leader Election
export { LeaderElection, type LeaderElectionOptions } from "./leader-election";

// Transports
export { BroadcastTransport } from "./transports/broadcast";
export { SignalingTransport, type SignalingTransportOptions } from "./transports/signaling";

// Hooks
export {
  type PeerInfo,
  type RemoteTransport,
  useSyncRoom,
  type UseSyncRoomOptions,
  type UseSyncRoomReturn,
} from "./hooks";

// Config constants
export * from "./config";
