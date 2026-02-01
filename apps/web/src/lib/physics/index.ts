/**
 * Shared physics constants used by both local simulation and CRDT state computation.
 * These must be identical across all clients for deterministic physics.
 */

/** Base friction factor applied each timestep */
export const FRICTION_BASE = 0.999;

/** Fixed timestep (seconds) for deterministic simulation - 60 FPS */
export const FIXED_DT = 1 / 60;

/** Velocity below this threshold is considered stopped */
export const VELOCITY_THRESHOLD = 0.05;

/** Maximum angular velocity (radians/second) */
export const MAX_ANGULAR_VELOCITY = 100;

/** One full rotation in radians */
export const FULL_ROTATION = Math.PI * 2;
