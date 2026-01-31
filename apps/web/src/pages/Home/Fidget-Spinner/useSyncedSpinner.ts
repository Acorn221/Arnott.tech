import { useCallback } from "react";
import { useSyncedState } from "@/lib/sync";
import {
  spinnerRegistration,
  type SpinnerEvent,
  type SpinnerState,
} from "./spinner-codec";

export interface UseSyncedSpinnerReturn {
  /** Compute current state at timestamp */
  computeState: (now: number) => SpinnerState;

  /** Emit a grab event (user started dragging) */
  grab: (rotation: number) => void;

  /** Emit a drag event (user is dragging) */
  drag: (rotation: number, velocity: number) => void;

  /** Emit a release event (user released spinner) */
  release: (rotation: number, velocity: number) => void;

  /** Whether we're synced with remote peers */
  isSynced: boolean;

  /** Current state (computed at render time) */
  state: SpinnerState;

  /** Get current event for syncing */
  getCurrentEvent: () => SpinnerEvent | null;
}

/**
 * Hook for synced spinner state.
 * Wraps useSyncedState with spinner-specific methods.
 *
 * @example
 * ```tsx
 * const { computeState, grab, drag, release, isSynced } = useSyncedSpinner();
 *
 * // In pointer handlers:
 * onPointerDown={() => grab(rotation)}
 * onPointerMove={() => drag(rotation, velocity)}
 * onPointerUp={() => release(rotation, velocity)}
 *
 * // In render loop:
 * useFrame(() => {
 *   const state = computeState(performance.now());
 *   mesh.rotation.y = state.rotation;
 * });
 * ```
 */
export function useSyncedSpinner(): UseSyncedSpinnerReturn {
  const {
    state,
    emit,
    computeState,
    getCurrentEvent,
    isSynced,
  } = useSyncedState<SpinnerEvent, SpinnerState>({
    registration: spinnerRegistration,
  });

  const grab = useCallback(
    (rotation: number) => {
      const event: SpinnerEvent = {
        type: "grab",
        timestamp: performance.now(),
        rotation,
      };
      emit(event);
    },
    [emit]
  );

  const drag = useCallback(
    (rotation: number, velocity: number) => {
      const event: SpinnerEvent = {
        type: "drag",
        timestamp: performance.now(),
        rotation,
        velocity,
      };
      emit(event);
    },
    [emit]
  );

  const release = useCallback(
    (rotation: number, velocity: number) => {
      const event: SpinnerEvent = {
        type: "release",
        timestamp: performance.now(),
        rotation,
        velocity,
      };
      emit(event);
    },
    [emit]
  );

  return {
    computeState,
    grab,
    drag,
    release,
    isSynced,
    state,
    getCurrentEvent,
  };
}
