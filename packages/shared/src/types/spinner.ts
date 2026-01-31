/**
 * State of the fidget spinner that gets synced across clients
 */
export interface SpinnerState {
  /** Current rotation in radians */
  rotation: number;
  /** Angular velocity in radians per second */
  angularVelocity: number;
  /** Whether a user is currently dragging the spinner */
  isDragging: boolean;
  /** ID of the user who is dragging (if any) */
  draggingUserId: string | null;
  /** Timestamp of when this state was recorded */
  timestamp: number;
  /** Total spin count */
  spinCount: number;
}

/**
 * Message types for WebSocket communication
 */
export type SpinnerMessage =
  | { type: "state"; payload: SpinnerState }
  | { type: "sync"; payload: SpinnerState }
  | { type: "join"; payload: { userId: string } }
  | { type: "leave"; payload: { userId: string } }
  | { type: "request-state" };

/**
 * Room info for the spinner
 */
export interface SpinnerRoomInfo {
  connectedUsers: number;
  totalSpins: number;
}
