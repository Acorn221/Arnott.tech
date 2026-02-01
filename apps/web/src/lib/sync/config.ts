/**
 * Sync system configuration constants.
 *
 * Centralizes all tunable parameters for the sync system.
 */

// --- Reconnection ---

/** Initial delay before first reconnect attempt (ms) */
export const RECONNECT_INITIAL_DELAY_MS = 1000;

/** Maximum delay between reconnect attempts (ms) */
export const RECONNECT_MAX_DELAY_MS = 30000;

/** Multiplier for exponential backoff */
export const RECONNECT_BACKOFF_MULTIPLIER = 2;

// --- WebRTC ---

/** Timeout for WebRTC connection establishment before falling back to WebSocket (ms) */
export const WEBRTC_CONNECTION_TIMEOUT_MS = 10000;

// --- Broadcast Channel ---

/** Interval for sending presence announcements to discover peers (ms) */
export const PRESENCE_INTERVAL_MS = 1000;

// --- Leader Election ---

/** Interval for leader heartbeat broadcasts (ms) */
export const LEADER_HEARTBEAT_INTERVAL_MS = 100;

/** Time without heartbeat before assuming leader is gone (ms) */
export const LEADER_TIMEOUT_MS = 500;

/** Delay before initial leader check on startup (ms) */
export const LEADER_INITIAL_CHECK_DELAY_MS = 150;

// --- Message Deduplication ---

/** Maximum number of message IDs to track for deduplication */
export const MAX_SEEN_MESSAGES = 1000;

// --- Clock Synchronization ---

/** Interval for periodic clock sync with peers (ms) */
export const CLOCK_SYNC_INTERVAL_MS = 30000;

/** Maximum message size that could be a time sync message (bytes) */
export const TIME_SYNC_MAX_MESSAGE_SIZE = 150;

/** Safety buffer added to time offset to account for latency variance (ms) */
export const TIME_SYNC_LATENCY_BUFFER_MS = 50;

// --- Test Instrumentation ---

/** Maximum number of messages to keep in test instrumentation buffer */
export const TEST_MAX_MESSAGES = 100;
