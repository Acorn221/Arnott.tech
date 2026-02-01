import { describe, it, expect } from "vitest";
import {
  getBestTransport,
  TRANSPORT_PRIORITY,
  type TransportType,
} from "../interfaces/types";

describe("TRANSPORT_PRIORITY", () => {
  it("has broadcast as highest priority (0)", () => {
    expect(TRANSPORT_PRIORITY.broadcast).toBe(0);
  });

  it("has webrtc as second priority (1)", () => {
    expect(TRANSPORT_PRIORITY.webrtc).toBe(1);
  });

  it("has websocket as lowest priority (2)", () => {
    expect(TRANSPORT_PRIORITY.websocket).toBe(2);
  });

  it("orders correctly: broadcast < webrtc < websocket", () => {
    expect(TRANSPORT_PRIORITY.broadcast).toBeLessThan(TRANSPORT_PRIORITY.webrtc);
    expect(TRANSPORT_PRIORITY.webrtc).toBeLessThan(TRANSPORT_PRIORITY.websocket);
  });
});

describe("getBestTransport", () => {
  it("returns null for empty set", () => {
    const transports = new Set<TransportType>();

    expect(getBestTransport(transports)).toBeNull();
  });

  it("returns broadcast when available", () => {
    const transports = new Set<TransportType>(["websocket", "webrtc", "broadcast"]);

    expect(getBestTransport(transports)).toBe("broadcast");
  });

  it("returns webrtc when broadcast not available", () => {
    const transports = new Set<TransportType>(["websocket", "webrtc"]);

    expect(getBestTransport(transports)).toBe("webrtc");
  });

  it("returns websocket when only option", () => {
    const transports = new Set<TransportType>(["websocket"]);

    expect(getBestTransport(transports)).toBe("websocket");
  });

  it("prefers broadcast over webrtc", () => {
    const transports = new Set<TransportType>(["webrtc", "broadcast"]);

    expect(getBestTransport(transports)).toBe("broadcast");
  });

  it("prefers webrtc over websocket", () => {
    const transports = new Set<TransportType>(["websocket", "webrtc"]);

    expect(getBestTransport(transports)).toBe("webrtc");
  });

  it("handles single broadcast", () => {
    const transports = new Set<TransportType>(["broadcast"]);

    expect(getBestTransport(transports)).toBe("broadcast");
  });

  it("handles single webrtc", () => {
    const transports = new Set<TransportType>(["webrtc"]);

    expect(getBestTransport(transports)).toBe("webrtc");
  });

  it("handles all three transports", () => {
    const transports = new Set<TransportType>(["broadcast", "webrtc", "websocket"]);

    expect(getBestTransport(transports)).toBe("broadcast");
  });
});
