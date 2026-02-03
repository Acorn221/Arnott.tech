import { describe, expect,it } from "vitest";

import { SignalingTransport } from "../transports/signaling";

/**
 * SignalingTransport unit tests.
 *
 * Note: Full WebSocket/WebRTC behavior is tested via E2E tests since
 * mocking WebSocket in happy-dom environment is unreliable.
 * These unit tests focus on synchronous state and configuration.
 */

describe("SignalingTransport", () => {
  describe("initial state", () => {
    it("starts disconnected", () => {
      const transport = new SignalingTransport();
      expect(transport.state).toBe("disconnected");
    });

    it("has type webrtc", () => {
      const transport = new SignalingTransport();
      expect(transport.type).toBe("webrtc");
    });

    it("has no local ID initially", () => {
      const transport = new SignalingTransport();
      expect(transport.getLocalId()).toBe("");
    });

    it("reports WebSocket as supported in browser environment", () => {
      const transport = new SignalingTransport();
      expect(transport.isSupported).toBe(true);
    });
  });

  describe("configuration", () => {
    it("accepts enableWebRTC option", () => {
      const transport = new SignalingTransport({ enableWebRTC: false });
      expect(transport.state).toBe("disconnected");
    });

    it("accepts maxReconnectAttempts option", () => {
      const transport = new SignalingTransport({ maxReconnectAttempts: 10 });
      expect(transport.state).toBe("disconnected");
    });

    it("accepts custom reconnect backoff", () => {
      const transport = new SignalingTransport({
        reconnectBackoff: {
          initial: 500,
          max: 60000,
          multiplier: 1.5,
        },
      });
      expect(transport.state).toBe("disconnected");
    });
  });

  describe("callbacks", () => {
    it("allows setting onReceive callback", () => {
      const transport = new SignalingTransport();
      const callback = () => {};
      transport.onReceive = callback;
      expect(transport.onReceive).toBe(callback);
    });

    it("allows setting onPeerReachable callback", () => {
      const transport = new SignalingTransport();
      const callback = () => {};
      transport.onPeerReachable = callback;
      expect(transport.onPeerReachable).toBe(callback);
    });

    it("allows setting onPeerUnreachable callback", () => {
      const transport = new SignalingTransport();
      const callback = () => {};
      transport.onPeerUnreachable = callback;
      expect(transport.onPeerUnreachable).toBe(callback);
    });

    it("allows setting onStateChange callback", () => {
      const transport = new SignalingTransport();
      const callback = () => {};
      transport.onStateChange = callback;
      expect(transport.onStateChange).toBe(callback);
    });
  });

  describe("hasPeerRTC", () => {
    it("returns false for unknown peer", () => {
      const transport = new SignalingTransport();
      expect(transport.hasPeerRTC("unknown-peer")).toBe(false);
    });
  });

  describe("broadcast when disconnected", () => {
    it("does nothing when not connected", () => {
      const transport = new SignalingTransport();
      const data = new TextEncoder().encode("hello").buffer;
      // Should not throw
      transport.broadcast(data);
      expect(transport.state).toBe("disconnected");
    });
  });

  describe("send when disconnected", () => {
    it("does nothing when not connected", () => {
      const transport = new SignalingTransport();
      const data = new TextEncoder().encode("hello").buffer;
      // Should not throw
      transport.send("some-peer", data);
      expect(transport.state).toBe("disconnected");
    });
  });

  describe("disconnect when already disconnected", () => {
    it("handles gracefully", async () => {
      const transport = new SignalingTransport();
      await transport.disconnect();
      expect(transport.state).toBe("disconnected");
    });
  });
});
