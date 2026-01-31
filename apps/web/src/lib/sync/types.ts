/**
 * Core sync interfaces for building synced components.
 *
 * Architecture:
 * - SyncCodec: Component-specific binary encoding/decoding
 * - StateComputer: Derive current state from an event + time
 * - ConflictResolver: Handle concurrent edits (LWW, etc.)
 */

/**
 * Binary codec for component-specific events.
 * Each component type has a unique typeId for multiplexing.
 */
export interface SyncCodec<TEvent> {
  /** Human-readable component type (e.g., "spinner") */
  componentType: string;

  /** Single byte identifier for multiplexing (1-255, 0 reserved) */
  typeId: number;

  /** Encode event to binary (includes typeId as first byte) */
  encode(event: TEvent): ArrayBuffer;

  /** Decode binary to event (typeId already stripped) */
  decode(buffer: ArrayBuffer): TEvent | null;
}

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

/**
 * Registration for a synced component type.
 * Bundles codec, state computer, and conflict resolver.
 */
export interface SyncRegistration<TEvent, TState> {
  codec: SyncCodec<TEvent>;
  stateComputer: StateComputer<TEvent, TState>;
  conflictResolver: ConflictResolver<TEvent>;
}

/**
 * Options for useSyncedState hook.
 */
export interface UseSyncedStateOptions<TEvent, TState> {
  registration: SyncRegistration<TEvent, TState>;
}

/**
 * Return type for useSyncedState hook.
 */
export interface UseSyncedStateReturn<TEvent, TState> {
  /** Current computed state */
  state: TState;

  /** Emit a local event (broadcasts to peers) */
  emit: (event: TEvent) => void;

  /** Compute state at a specific timestamp */
  computeState: (now: number) => TState;

  /** Get the current event (for syncing to new peers) */
  getCurrentEvent: () => TEvent | null;

  /** Apply remote event (used internally by provider) */
  applyRemoteEvent: (event: TEvent) => void;

  /** Whether we're connected and synced with peers */
  isSynced: boolean;
}

/**
 * Time sync message exchanged between peers.
 */
export interface TimeSyncMessage {
  type: "time-sync";
  localTime: number;
}

/**
 * State sync message for sharing current state with new peers.
 */
export interface StateSyncMessage {
  type: "state-sync";
  typeId: number;
  data: ArrayBuffer;
}

/**
 * Context value provided by SyncProvider.
 */
export interface SyncContextValue {
  /** Whether connected to the room */
  isConnected: boolean;

  /** Number of connected peers */
  peerCount: number;

  /** Our peer ID (null if not connected) */
  peerId: string | null;

  /** Join the room */
  join: () => Promise<void>;

  /** Leave the room */
  leave: () => Promise<void>;

  /** Register a component type for syncing */
  register: <TEvent, TState>(
    registration: SyncRegistration<TEvent, TState>,
    callbacks: {
      onRemoteEvent: (event: TEvent) => void;
      getCurrentEvent: () => TEvent | null;
    }
  ) => () => void;

  /** Broadcast binary data */
  broadcast: (data: ArrayBuffer) => void;

  /** Get time offset for a peer */
  getTimeOffset: (peerId: string) => number;

  /** Get average time offset across all peers */
  getAverageTimeOffset: () => number;
}
