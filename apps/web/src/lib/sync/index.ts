// Core types
export type { StateComputer, ConflictResolver } from "./types";

// Coordinator
export { SyncCoordinator, type CoordinatorState, type SyncCoordinatorOptions } from "./sync-coordinator";
export { PeerRegistry, type Peer } from "./peer-registry";
export { LeaderElection, type LeaderElectionOptions } from "./leader-election";

// Routes
export {
  type Route,
  type RouteType,
  type RouteState,
  ROUTE_PRIORITY,
  getBestRoute,
  BroadcastRoute,
  SignalingRoute,
  type SignalingRouteOptions,
} from "./transport";

// Hooks
export {
  useSyncRoom,
  type UseSyncRoomOptions,
  type UseSyncRoomReturn,
} from "./hooks";

