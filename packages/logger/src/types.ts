export type LogLevel = "debug" | "info" | "warn" | "error" | "none";

export interface LogEntry {
  level: Exclude<LogLevel, "none">;
  namespace: string;
  message: string;
  data?: unknown;
  timestamp: number;
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  child(namespace: string): Logger;
}

export interface LoggerConfig {
  level: LogLevel;
  enabledNamespaces: Set<string>;
  output: (entry: LogEntry) => void;
}
