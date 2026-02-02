import type {
  StateComputer,
  ConflictResolver,
} from "@/lib/sync";
import {
  FRICTION_BASE,
  FIXED_DT,
  VELOCITY_THRESHOLD,
} from "@/lib/physics";

// Binary message types
const MSG_GRAB = 0;
const MSG_DRAG = 1;
const MSG_RELEASE = 2;

// Pre-allocate buffer for encoding (25 bytes max: type(1) + timestamp(8) + rotation(8) + velocity(8))
const encodeBuffer = new ArrayBuffer(25);
const encodeView = new DataView(encodeBuffer);

/**
 * Spinner event types.
 */
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

/**
 * Spinner state at a point in time.
 */
export interface SpinnerState {
  rotation: number;
  velocity: number;
}

/**
 * Encode spinner event to binary.
 * Returns a slice copy for safe async sending.
 */
export function encodeSpinnerEvent(event: SpinnerEvent): ArrayBuffer {
  if (event.type === "grab") {
    encodeView.setUint8(0, MSG_GRAB);
    encodeView.setFloat64(1, event.timestamp, true);
    encodeView.setFloat64(9, event.rotation, true);
    return encodeBuffer.slice(0, 17);
  } else if (event.type === "drag") {
    encodeView.setUint8(0, MSG_DRAG);
    encodeView.setFloat64(1, event.timestamp, true);
    encodeView.setFloat64(9, event.rotation, true);
    encodeView.setFloat64(17, event.velocity, true);
    return encodeBuffer.slice(0, 25);
  } else {
    encodeView.setUint8(0, MSG_RELEASE);
    encodeView.setFloat64(1, event.timestamp, true);
    encodeView.setFloat64(9, event.rotation, true);
    encodeView.setFloat64(17, event.velocity, true);
    return encodeBuffer.slice(0, 25);
  }
}

/**
 * Decode binary to spinner event.
 */
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

/**
 * Deterministically compute spinner state from a release event.
 * Uses fixed timestep to ensure identical results across clients.
 */
export function computeStateFromRelease(
  event: { rotation: number; velocity: number; timestamp: number },
  now: number
): SpinnerState {
  // Clamp elapsed to 0 if timestamp is in the future (network jitter, clock skew)
  const elapsed = Math.max(0, (now - event.timestamp) / 1000);

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

/**
 * StateComputer for spinner state.
 */
export const spinnerStateComputer: StateComputer<SpinnerEvent, SpinnerState> = {
  compute(event: SpinnerEvent, now: number): SpinnerState {
    if (event.type === "grab") {
      return { rotation: event.rotation, velocity: 0 };
    }

    if (event.type === "drag") {
      return { rotation: event.rotation, velocity: event.velocity };
    }

    // Release event - compute current state from physics
    return computeStateFromRelease(event, now);
  },

  initialState(): SpinnerState {
    return { rotation: 0, velocity: 0 };
  },
};

/**
 * ConflictResolver for spinner events.
 * Simple: latest event always wins.
 *
 * NOTE: Timestamps use Date.now() (absolute wall-clock time) for consistency
 * across tabs, instead of performance.now() which is relative to page load.
 */
export const spinnerConflictResolver: ConflictResolver<SpinnerEvent> = {
  shouldReplace(
    current: SpinnerEvent | null,
    incoming: SpinnerEvent,
    _timeOffset: number
  ): boolean {
    if (!current) return true;
    // Latest event wins - simple and predictable
    return incoming.timestamp >= current.timestamp;
  },

  adjustTimestamp(event: SpinnerEvent, _timeOffset: number): SpinnerEvent {
    // With Date.now() timestamps, no adjustment needed for local tabs.
    // Remote peers might have clock skew, but Date.now() is close enough
    // and much simpler than trying to sync performance.now() across origins.
    const now = Date.now();

    // Clamp future timestamps to now
    if (event.timestamp > now) {
      return { ...event, timestamp: now };
    }

    return event;
  },
};
