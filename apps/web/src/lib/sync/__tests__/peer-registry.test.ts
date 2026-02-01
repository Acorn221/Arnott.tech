import { describe, it, expect, beforeEach, vi } from "vitest";
import { PeerRegistry } from "../peer-registry";
import type { TransportType } from "../interfaces/types";

describe("PeerRegistry", () => {
  let registry: PeerRegistry;

  beforeEach(() => {
    registry = new PeerRegistry();
  });

  describe("addTransport", () => {
    it("creates a new peer when adding transport to unknown peer", () => {
      const result = registry.addTransport("peer-1", "broadcast", true);

      expect(result.isNewPeer).toBe(true);
      expect(result.isNewTransport).toBe(true);
      expect(result.peer.id).toBe("peer-1");
      expect(result.peer.isLocal).toBe(true);
      expect(result.peer.transports.has("broadcast")).toBe(true);
      expect(result.peer.timeOffset).toBe(0);
    });

    it("adds transport to existing peer without marking as new", () => {
      registry.addTransport("peer-1", "broadcast", true);
      const result = registry.addTransport("peer-1", "webrtc", false);

      expect(result.isNewPeer).toBe(false);
      expect(result.isNewTransport).toBe(true);
      expect(result.peer.transports.has("broadcast")).toBe(true);
      expect(result.peer.transports.has("webrtc")).toBe(true);
    });

    it("does not mark as new transport when transport already exists", () => {
      registry.addTransport("peer-1", "broadcast", true);
      const result = registry.addTransport("peer-1", "broadcast", true);

      expect(result.isNewPeer).toBe(false);
      expect(result.isNewTransport).toBe(false);
    });

    it("preserves isLocal=true once set", () => {
      registry.addTransport("peer-1", "webrtc", false);
      const result = registry.addTransport("peer-1", "broadcast", true);

      expect(result.peer.isLocal).toBe(true);
    });

    it("updates lastSeen timestamp", async () => {
      const result1 = registry.addTransport("peer-1", "broadcast", true);
      const firstSeen = result1.peer.lastSeen;

      // Wait a bit to ensure time difference (performance.now() based)
      await new Promise((resolve) => setTimeout(resolve, 5));

      const result2 = registry.addTransport("peer-1", "webrtc", false);
      expect(result2.peer.lastSeen).toBeGreaterThanOrEqual(firstSeen);
    });
  });

  describe("removeTransport", () => {
    it("removes transport but keeps peer if other transports exist", () => {
      registry.addTransport("peer-1", "broadcast", true);
      registry.addTransport("peer-1", "webrtc", false);

      const result = registry.removeTransport("peer-1", "broadcast");

      expect(result.peerRemoved).toBe(false);
      expect(result.peer).not.toBeNull();
      expect(result.peer?.transports.has("broadcast")).toBe(false);
      expect(result.peer?.transports.has("webrtc")).toBe(true);
    });

    it("removes peer entirely when last transport removed", () => {
      registry.addTransport("peer-1", "broadcast", true);

      const result = registry.removeTransport("peer-1", "broadcast");

      expect(result.peerRemoved).toBe(true);
      expect(result.peer).toBeNull();
      expect(registry.getPeer("peer-1")).toBeUndefined();
    });

    it("returns gracefully for unknown peer", () => {
      const result = registry.removeTransport("unknown", "broadcast");

      expect(result.peerRemoved).toBe(false);
      expect(result.peer).toBeNull();
    });

    it("returns gracefully when removing non-existent transport", () => {
      registry.addTransport("peer-1", "broadcast", true);

      const result = registry.removeTransport("peer-1", "webrtc");

      expect(result.peerRemoved).toBe(false);
      expect(result.peer).not.toBeNull();
    });
  });

  describe("setTimeOffset", () => {
    it("updates offset on existing peer", () => {
      registry.addTransport("peer-1", "broadcast", true);

      registry.setTimeOffset("peer-1", 123);

      const peer = registry.getPeer("peer-1");
      expect(peer?.timeOffset).toBe(123);
    });

    it("does nothing for unknown peer", () => {
      registry.setTimeOffset("unknown", 123);

      expect(registry.getPeer("unknown")).toBeUndefined();
    });
  });

  describe("getTimeOffset", () => {
    it("returns offset for known peer", () => {
      registry.addTransport("peer-1", "broadcast", true);
      registry.setTimeOffset("peer-1", 456);

      expect(registry.getTimeOffset("peer-1")).toBe(456);
    });

    it("returns 0 for unknown peer", () => {
      expect(registry.getTimeOffset("unknown")).toBe(0);
    });
  });

  describe("touch", () => {
    it("updates lastSeen timestamp", () => {
      const result = registry.addTransport("peer-1", "broadcast", true);
      const initialLastSeen = result.peer.lastSeen;

      // Touch the peer
      registry.touch("peer-1");

      const peer = registry.getPeer("peer-1");
      expect(peer?.lastSeen).toBeGreaterThanOrEqual(initialLastSeen);
    });

    it("does nothing for unknown peer", () => {
      registry.touch("unknown");
      expect(registry.getPeer("unknown")).toBeUndefined();
    });
  });

  describe("getBestTransport", () => {
    it("returns broadcast when available (highest priority)", () => {
      registry.addTransport("peer-1", "webrtc", false);
      registry.addTransport("peer-1", "broadcast", true);
      registry.addTransport("peer-1", "websocket", false);

      expect(registry.getBestTransport("peer-1")).toBe("broadcast");
    });

    it("returns webrtc when broadcast not available", () => {
      registry.addTransport("peer-1", "webrtc", false);
      registry.addTransport("peer-1", "websocket", false);

      expect(registry.getBestTransport("peer-1")).toBe("webrtc");
    });

    it("returns websocket when only option", () => {
      registry.addTransport("peer-1", "websocket", false);

      expect(registry.getBestTransport("peer-1")).toBe("websocket");
    });

    it("returns null for unknown peer", () => {
      expect(registry.getBestTransport("unknown")).toBeNull();
    });
  });

  describe("getPeer", () => {
    it("returns peer when exists", () => {
      registry.addTransport("peer-1", "broadcast", true);

      const peer = registry.getPeer("peer-1");

      expect(peer).toBeDefined();
      expect(peer?.id).toBe("peer-1");
    });

    it("returns undefined for unknown peer", () => {
      expect(registry.getPeer("unknown")).toBeUndefined();
    });
  });

  describe("getAllPeers", () => {
    it("returns empty array when no peers", () => {
      expect(registry.getAllPeers()).toEqual([]);
    });

    it("returns all peers", () => {
      registry.addTransport("peer-1", "broadcast", true);
      registry.addTransport("peer-2", "webrtc", false);

      const peers = registry.getAllPeers();

      expect(peers).toHaveLength(2);
      expect(peers.map((p) => p.id).sort()).toEqual(["peer-1", "peer-2"]);
    });
  });

  describe("hasPeer", () => {
    it("returns true for existing peer", () => {
      registry.addTransport("peer-1", "broadcast", true);
      expect(registry.hasPeer("peer-1")).toBe(true);
    });

    it("returns false for unknown peer", () => {
      expect(registry.hasPeer("unknown")).toBe(false);
    });
  });

  describe("size", () => {
    it("returns 0 when empty", () => {
      expect(registry.size).toBe(0);
    });

    it("returns correct count", () => {
      registry.addTransport("peer-1", "broadcast", true);
      registry.addTransport("peer-2", "broadcast", true);

      expect(registry.size).toBe(2);
    });
  });

  describe("clear", () => {
    it("removes all peers", () => {
      registry.addTransport("peer-1", "broadcast", true);
      registry.addTransport("peer-2", "broadcast", true);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.getAllPeers()).toEqual([]);
    });
  });

  describe("onChange callback", () => {
    it("fires on addTransport", () => {
      const onChange = vi.fn();
      registry.onChange = onChange;

      registry.addTransport("peer-1", "broadcast", true);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: "peer-1" })]));
    });

    it("fires on removeTransport", () => {
      registry.addTransport("peer-1", "broadcast", true);

      const onChange = vi.fn();
      registry.onChange = onChange;

      registry.removeTransport("peer-1", "broadcast");

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith([]);
    });

    it("fires on clear", () => {
      registry.addTransport("peer-1", "broadcast", true);

      const onChange = vi.fn();
      registry.onChange = onChange;

      registry.clear();

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith([]);
    });
  });
});
