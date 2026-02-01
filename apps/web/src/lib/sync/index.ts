// Core types
export type { StateComputer, ConflictResolver } from "./types";

// Interfaces
export type {
  TransportType,
  TransportState,
  TransportConfig,
  Peer,
} from "./interfaces/types";
export type { ITransport } from "./interfaces/transport";
export { TRANSPORT_PRIORITY, getBestTransport, SYNC_ROOM_ID } from "./interfaces/types";

// Coordinator
export {
  SyncCoordinator,
  type CoordinatorState,
  type SyncCoordinatorOptions,
} from "./sync-coordinator";

// Registry
export { PeerRegistry, type AddTransportResult, type RemoveTransportResult } from "./peer-registry";

// Time Sync
export { TimeSyncManager, type TimeSyncMessage, type TimeSyncResult } from "./time-sync-manager";

// Leader Election
export { LeaderElection, type LeaderElectionOptions } from "./leader-election";

// Transports
export { BroadcastTransport } from "./transports/broadcast";
export { SignalingTransport, type SignalingTransportOptions } from "./transports/signaling";

// Hooks
export {
  useSyncRoom,
  type UseSyncRoomOptions,
  type UseSyncRoomReturn,
  type PeerInfo,
  type RemoteTransport,
} from "./hooks";
