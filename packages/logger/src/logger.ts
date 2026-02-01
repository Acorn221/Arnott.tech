import { config, shouldLog } from "./config.js";
import type { Logger, LogLevel, LogEntry } from "./types.js";

export function createLogger(namespace: string): Logger {
  const log = (
    level: Exclude<LogLevel, "none">,
    message: string,
    data?: unknown
  ) => {
    if (!shouldLog(namespace, level)) return;

    const entry: LogEntry = {
      level,
      namespace,
      message,
      data,
      timestamp: Date.now(),
    };

    config.output(entry);
  };

  return {
    debug: (msg, data) => log("debug", msg, data),
    info: (msg, data) => log("info", msg, data),
    warn: (msg, data) => log("warn", msg, data),
    error: (msg, data) => log("error", msg, data),
    child: (sub) => createLogger(`${namespace}:${sub}`),
  };
}
