export { createLogger } from "./logger.js";
export {
  setLogLevel,
  enableNamespace,
  disableNamespace,
  clearNamespaces,
} from "./config.js";
export type { Logger, LogLevel, LogEntry, LoggerConfig } from "./types.js";

import {
  setLogLevel as _setLogLevel,
  enableNamespace as _enableNamespace,
} from "./config.js";

// Expose to window for debugging (dev only)
if (typeof window !== "undefined" && import.meta.env.DEV) {
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
  const w = window as any;
  w.__setLogLevel = _setLogLevel;
  w.__enableNamespace = _enableNamespace;
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
}
