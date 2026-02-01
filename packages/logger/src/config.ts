import type { LogLevel, LoggerConfig } from "./types.js";
import { consoleOutput } from "./formatters.js";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

function parseNamespacePatterns(patterns: string): Set<string> {
  if (!patterns) return new Set();
  return new Set(
    patterns
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
  );
}

function patternMatches(namespace: string, pattern: string): boolean {
  if (pattern === "*") return true;

  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  return new RegExp(`^${regexPattern}$`).test(namespace);
}

export function isNamespaceEnabled(
  namespace: string,
  patterns: Set<string>
): boolean {
  if (patterns.size === 0) return true;
  for (const pattern of patterns) {
    if (patternMatches(namespace, pattern)) return true;
  }
  return false;
}

function getInitialLevel(): LogLevel {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const envLevel = import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined;
    if (envLevel && envLevel in LOG_LEVELS) {
      return envLevel;
    }
    return import.meta.env.DEV ? "debug" : "info";
  }
  return "info";
}

function getInitialNamespaces(): Set<string> {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const debug = import.meta.env.VITE_DEBUG as string | undefined;
    if (debug) {
      return parseNamespacePatterns(debug);
    }
  }
  return new Set();
}

export const config: LoggerConfig = {
  level: getInitialLevel(),
  enabledNamespaces: getInitialNamespaces(),
  output: consoleOutput,
};

export function setLogLevel(level: LogLevel): void {
  config.level = level;
}

export function enableNamespace(pattern: string): void {
  config.enabledNamespaces.add(pattern);
}

export function disableNamespace(pattern: string): void {
  config.enabledNamespaces.delete(pattern);
}

export function clearNamespaces(): void {
  config.enabledNamespaces.clear();
}

export function shouldLog(namespace: string, level: LogLevel): boolean {
  if (level === "none") return false;
  if (LOG_LEVELS[level] < LOG_LEVELS[config.level]) return false;
  return isNamespaceEnabled(namespace, config.enabledNamespaces);
}
