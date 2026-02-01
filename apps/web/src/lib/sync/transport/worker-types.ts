/**
 * Types for SharedWorker communication
 */

import type { TransportState, SyncMessage } from "./types";

/** Messages from tab to worker */
export type TabToWorkerMessage =
  | { type: "join"; roomId: string }
  | { type: "leave" }
  | { type: "broadcast"; data: ArrayBuffer | string }
  | { type: "sendTo"; peerId: string; data: ArrayBuffer | string }
  | { type: "setTimeOffset"; peerId: string; offset: number }
  | { type: "getState" };

/** Messages from worker to tab */
export type WorkerToTabMessage =
  | { type: "message"; message: SyncMessage }
  | { type: "stateChange"; state: TransportState }
  | { type: "peerConnect"; peerId: string }
  | { type: "peerDisconnect"; peerId: string }
  | { type: "state"; state: WorkerState }
  | { type: "error"; error: string }
  | { type: "ready" }
  | { type: "joined"; roomId: string };

/** Worker internal state (for debugging) */
export interface WorkerState {
  roomId: string | null;
  transportState: TransportState;
  peerCount: number;
  tabCount: number;
}
