import { useRef, useCallback } from "react";

// Physics constants (must match interactive-spinner.tsx)
const FRICTION_BASE = 0.999;
const FIXED_DT = 1 / 60; // Fixed timestep for deterministic simulation
const VELOCITY_THRESHOLD = 0.05;

// Binary message types
const MSG_GRAB = 0;
const MSG_DRAG = 1;
const MSG_RELEASE = 2;

// Pre-allocate buffer for encoding (25 bytes max)
const encodeBuffer = new ArrayBuffer(25);
const encodeView = new DataView(encodeBuffer);

/** Encode spinner event to binary - zero allocation, returns full buffer */
export function encodeSpinnerEvent(event: SpinnerEvent): ArrayBuffer {
  if (event.type === "grab") {
    encodeView.setUint8(0, MSG_GRAB);
    encodeView.setFloat64(1, event.timestamp, true);
    encodeView.setFloat64(9, event.rotation, true);
    // Bytes 17-24 unused for grab, but we send full buffer to avoid allocation
  } else if (event.type === "drag") {
    encodeView.setUint8(0, MSG_DRAG);
    encodeView.setFloat64(1, event.timestamp, true);
    encodeView.setFloat64(9, event.rotation, true);
    encodeView.setFloat64(17, event.velocity, true);
  } else {
    encodeView.setUint8(0, MSG_RELEASE);
    encodeView.setFloat64(1, event.timestamp, true);
    encodeView.setFloat64(9, event.rotation, true);
    encodeView.setFloat64(17, event.velocity, true);
  }
  return encodeBuffer;
}

/** Decode binary to spinner event */
export function decodeSpinnerEvent(buffer: ArrayBuffer): SpinnerEvent | null {
  const view = new DataView(buffer);
  const type = view.getUint8(0);
  const timestamp = view.getFloat64(1, true);
  const rotation = view.getFloat64(9, true);

  if (type === MSG_GRAB) {
    return { type: "grab", timestamp, rotation };
  } else if (type === MSG_DRAG) {
    const velocity = view.getFloat64(17, true);
    return { type: "drag", timestamp, rotation, velocity };
  } else if (type === MSG_RELEASE) {
    const velocity = view.getFloat64(17, true);
    return { type: "release", timestamp, rotation, velocity };
  }
  return null;
}

export type SpinnerEvent =
  | {
      type: "release";
      timestamp: number;
      rotation: number;
      velocity: number;
    }
  | {
      type: "grab";
      timestamp: number;
      rotation: number;
    }
  | {
      type: "drag";
      timestamp: number;
      rotation: number;
      velocity: number;
    };

export interface SpinnerState {
  rotation: number;
  velocity: number;
}

export interface UseSpinnerCRDTOptions {
  onEventEmit?: (event: SpinnerEvent) => void;
}

export interface UseSpinnerCRDTReturn {
  /** Compute current state from the latest event */
  computeState: (now: number) => SpinnerState;
  /** Get the current event (for syncing to new peers) */
  getCurrentEvent: () => SpinnerEvent | null;
  /** Emit a grab event (user started dragging) */
  grab: (rotation: number) => void;
  /** Emit a drag event (user is dragging - throttled) */
  drag: (rotation: number, velocity: number) => void;
  /** Emit a release event (user released spinner with velocity) */
  release: (rotation: number, velocity: number) => void;
  /** Apply a remote event (from another peer) */
  applyRemoteEvent: (event: SpinnerEvent) => void;
  /** Set time offset for synchronization */
  setTimeOffset: (offset: number) => void;
  /** Check if there's an active event */
  hasEvent: () => boolean;
}

/**
 * Deterministically compute spinner state from a release event.
 * Uses fixed timestep to ensure identical results across clients.
 */
function computeStateFromRelease(
  event: { rotation: number; velocity: number; timestamp: number },
  now: number
): SpinnerState {
  const elapsed = (now - event.timestamp) / 1000;

  if (elapsed <= 0) {
    return { rotation: event.rotation, velocity: event.velocity };
  }

  let velocity = event.velocity;
  let rotation = event.rotation;

  // Simulate physics with fixed timestep for determinism
  const steps = Math.floor(elapsed / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    const speed = Math.abs(velocity);
    const frictionFactor = Math.max(FRICTION_BASE - speed * 0.0001, 0.995);
    velocity *= frictionFactor;

    if (Math.abs(velocity) < VELOCITY_THRESHOLD) {
      velocity = 0;
      break;
    }

    rotation -= velocity * FIXED_DT;
  }

  // Handle remaining fractional step
  const remainingTime = elapsed - steps * FIXED_DT;
  if (remainingTime > 0 && velocity !== 0) {
    rotation -= velocity * remainingTime;
  }

  return { rotation, velocity };
}

export function useSpinnerCRDT(
  options: UseSpinnerCRDTOptions = {}
): UseSpinnerCRDTReturn {
  const { onEventEmit } = options;

  // Current event (latest wins by timestamp)
  const currentEventRef = useRef<SpinnerEvent | null>(null);

  // Time offset between local and remote clocks
  const timeOffsetRef = useRef(0);

  const computeState = useCallback((now: number): SpinnerState => {
    const event = currentEventRef.current;

    if (!event) {
      return { rotation: 0, velocity: 0 };
    }

    if (event.type === "grab") {
      // Spinner is grabbed - stationary at grab position
      return { rotation: event.rotation, velocity: 0 };
    }

    if (event.type === "drag") {
      // Spinner is being dragged - show current position and velocity
      return { rotation: event.rotation, velocity: event.velocity };
    }

    // Release event - compute current state from physics
    return computeStateFromRelease(event, now);
  }, []);

  const getCurrentEvent = useCallback((): SpinnerEvent | null => {
    return currentEventRef.current;
  }, []);

  const grab = useCallback(
    (rotation: number) => {
      const now = performance.now();
      const event: SpinnerEvent = {
        type: "grab",
        timestamp: now,
        rotation,
      };
      currentEventRef.current = event;
      onEventEmit?.(event);
    },
    [onEventEmit]
  );

  const drag = useCallback(
    (rotation: number, velocity: number) => {
      const now = performance.now();
      const event: SpinnerEvent = {
        type: "drag",
        timestamp: now,
        rotation,
        velocity,
      };
      currentEventRef.current = event;
      onEventEmit?.(event);
    },
    [onEventEmit]
  );

  const release = useCallback(
    (rotation: number, velocity: number) => {
      const now = performance.now();
      const event: SpinnerEvent = {
        type: "release",
        timestamp: now,
        rotation,
        velocity,
      };
      currentEventRef.current = event;
      onEventEmit?.(event);
    },
    [onEventEmit]
  );

  const applyRemoteEvent = useCallback((event: SpinnerEvent) => {
    // Apply time offset to convert remote timestamp to local time
    const adjustedEvent = {
      ...event,
      timestamp: event.timestamp + timeOffsetRef.current,
    };

    const current = currentEventRef.current;

    // Latest timestamp wins (CRDT last-writer-wins semantics)
    if (!current || adjustedEvent.timestamp > current.timestamp) {
      currentEventRef.current = adjustedEvent;
    }
  }, []);

  const setTimeOffset = useCallback((offset: number) => {
    timeOffsetRef.current = offset;
  }, []);

  const hasEvent = useCallback(() => {
    return currentEventRef.current !== null;
  }, []);

  return {
    computeState,
    getCurrentEvent,
    grab,
    drag,
    release,
    applyRemoteEvent,
    setTimeOffset,
    hasEvent,
  };
}
