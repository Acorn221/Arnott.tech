/**
 * Core sync interfaces for building synced components.
 */

/**
 * Computes current state from an event at a given timestamp.
 * Handles deterministic physics simulation for predictive state.
 */
export interface StateComputer<TEvent, TState> {
  /** Compute current state from event at timestamp `now` */
  compute(event: TEvent, now: number): TState;

  /** Return initial state (before any events) */
  initialState(): TState;
}

/**
 * Resolves conflicts between concurrent events.
 * Typical strategy: Last-Write-Wins by timestamp.
 */
export interface ConflictResolver<TEvent> {
  /**
   * Should incoming event replace current event?
   * @param current - Current event (null if none)
   * @param incoming - Incoming event from remote peer
   * @param timeOffset - Offset to convert remote timestamps to local time
   * @returns true if incoming should replace current
   */
  shouldReplace(current: TEvent | null, incoming: TEvent, timeOffset: number): boolean;

  /**
   * Adjust event timestamp using time offset.
   * @param event - Event with remote timestamp
   * @param timeOffset - Offset to add to convert to local time
   * @returns Event with adjusted timestamp
   */
  adjustTimestamp(event: TEvent, timeOffset: number): TEvent;
}
