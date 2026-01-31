import { useCallback, useEffect, useRef, useState } from "react";
import { useSyncOptional } from "./useSync";
import type {
  SyncRegistration,
  UseSyncedStateOptions,
  UseSyncedStateReturn,
} from "./types";

/**
 * Generic hook for synced state.
 * Handles event storage, conflict resolution, and state computation.
 *
 * @example
 * ```tsx
 * const { state, emit, computeState, isSynced } = useSyncedState({
 *   registration: spinnerRegistration,
 * });
 * ```
 */
export function useSyncedState<TEvent, TState>(
  options: UseSyncedStateOptions<TEvent, TState>
): UseSyncedStateReturn<TEvent, TState> {
  const { registration } = options;
  const { codec, stateComputer, conflictResolver } = registration;

  // Optional sync context (works without provider for local-only mode)
  const sync = useSyncOptional();

  // Current event ref (latest wins)
  const currentEventRef = useRef<TEvent | null>(null);

  // Force re-render trigger for state updates
  const [, setRenderTrigger] = useState(0);
  const triggerRender = useCallback(() => {
    setRenderTrigger((prev) => prev + 1);
  }, []);

  // Compute state from current event
  const computeState = useCallback(
    (now: number): TState => {
      const event = currentEventRef.current;
      if (!event) {
        return stateComputer.initialState();
      }
      return stateComputer.compute(event, now);
    },
    [stateComputer]
  );

  // Get current event (for syncing to new peers)
  const getCurrentEvent = useCallback((): TEvent | null => {
    return currentEventRef.current;
  }, []);

  // Apply remote event with conflict resolution
  const applyRemoteEvent = useCallback(
    (event: TEvent) => {
      const timeOffset = sync?.getAverageTimeOffset() ?? 0;

      // Adjust timestamp
      const adjustedEvent = conflictResolver.adjustTimestamp(event, timeOffset);

      // Check if should replace
      if (conflictResolver.shouldReplace(currentEventRef.current, adjustedEvent, timeOffset)) {
        currentEventRef.current = adjustedEvent;
        triggerRender();
      }
    },
    [sync, conflictResolver, triggerRender]
  );

  // Emit local event
  const emit = useCallback(
    (event: TEvent) => {
      currentEventRef.current = event;
      triggerRender();

      // Broadcast to peers if connected
      if (sync?.isConnected) {
        const encoded = codec.encode(event);
        // Prepend typeId
        const withTypeId = new Uint8Array(encoded.byteLength + 1);
        withTypeId[0] = codec.typeId;
        withTypeId.set(new Uint8Array(encoded), 1);
        sync.broadcast(withTypeId.buffer);
      }
    },
    [sync, codec, triggerRender]
  );

  // Register with provider on mount
  useEffect(() => {
    if (!sync) return;

    const unregister = sync.register(registration as SyncRegistration<unknown, unknown>, {
      onRemoteEvent: applyRemoteEvent as (event: unknown) => void,
      getCurrentEvent: getCurrentEvent as () => unknown | null,
    });

    return unregister;
  }, [sync, registration, applyRemoteEvent, getCurrentEvent]);

  // Compute current state
  const state = computeState(performance.now());

  // isSynced is true when connected (even if no peers yet)
  const isSynced = sync?.isConnected ?? false;

  return {
    state,
    emit,
    computeState,
    getCurrentEvent,
    applyRemoteEvent,
    isSynced,
  };
}
