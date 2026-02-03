/**
 * Animation constants for the SlotMachine component.
 * Consolidated here for easier tuning and maintenance.
 */

/** Rumble effect when pulling the handle */
export const RUMBLE = {
  DURATION: 0.5,
  INTENSITY: 0.02,
  FREQUENCY: 6,
} as const;

/** Reel spinning physics and geometry */
export const REEL = {
  /** Number of faces on the octagonal reel */
  GEOMETRY_FACES: 8,
  /** Velocity decay per frame during deceleration */
  FRICTION: 0.92,
  /** Velocity threshold to begin settling */
  MIN_VELOCITY: 0.5,
  /** Seconds between texture swaps during spin */
  SWAP_INTERVAL: 0.4,
  /** Offset to center faces (360/8/2 = 22.5 degrees = π/8 radians) */
  FACE_ALIGNMENT_OFFSET: Math.PI / 8,
} as const;

/** Share button press animation */
export const BUTTON = {
  /** Z-axis depth of button press */
  PRESS_DEPTH: 0.0006,
  /** Duration of press animation in seconds */
  PRESS_DURATION: 0.08,
} as const;

/** Sound effect timing */
export const SOUND = {
  /** Seconds between click sounds during spin */
  CLICK_INTERVAL: 0.08,
} as const;

/** Reel spinner mesh names in the 3D model */
export const SPINNER_NAMES = [
  "slot-spinner-1",
  "slot-spinner-2",
  "slot-spinner-3",
] as const;
