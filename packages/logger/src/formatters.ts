import type { LogEntry } from "./types.js";

const COLORS = [
  "#e6194b",
  "#3cb44b",
  "#ffe119",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#46f0f0",
  "#f032e6",
  "#bcf60c",
  "#fabebe",
  "#008080",
  "#e6beff",
  "#9a6324",
  "#fffac8",
  "#800000",
  "#aaffc3",
  "#808000",
  "#ffd8b1",
  "#000075",
  "#808080",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getNamespaceColor(namespace: string): string {
  const index = hashString(namespace) % COLORS.length;
  return COLORS[index];
}

export function consoleOutput(entry: LogEntry): void {
  const color = getNamespaceColor(entry.namespace);
  const prefix = `%c${entry.namespace}`;
  const style = `color: ${color}; font-weight: bold`;

  const method = entry.level === "debug" ? "log" : entry.level;

  if (entry.data !== undefined) {
    console[method](prefix, style, entry.message, entry.data);
  } else {
    console[method](prefix, style, entry.message);
  }
}
