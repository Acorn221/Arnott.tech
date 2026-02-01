import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TimeSyncManager, type TimeSyncMessage } from "../time-sync-manager";

describe("TimeSyncManager", () => {
  let timeSync: TimeSyncManager;

  beforeEach(() => {
    timeSync = new TimeSyncManager();
  });

  describe("createSyncMessage", () => {
    it("returns an ArrayBuffer", () => {
      const msg = timeSync.createSyncMessage();

      expect(msg).toBeInstanceOf(ArrayBuffer);
    });

    it("contains valid JSON with type and localTime", () => {
      const msg = timeSync.createSyncMessage();
      const text = new TextDecoder().decode(msg);
      const parsed = JSON.parse(text) as TimeSyncMessage;

      expect(parsed.type).toBe("time-sync");
      expect(typeof parsed.localTime).toBe("number");
    });

    it("uses current performance.now() for localTime", () => {
      const before = performance.now();
      const msg = timeSync.createSyncMessage();
      const after = performance.now();

      const text = new TextDecoder().decode(msg);
      const parsed = JSON.parse(text) as TimeSyncMessage;

      expect(parsed.localTime).toBeGreaterThanOrEqual(before);
      expect(parsed.localTime).toBeLessThanOrEqual(after);
    });
  });

  describe("isTimeSyncMessage", () => {
    it("returns true for valid time-sync message", () => {
      const msg: TimeSyncMessage = { type: "time-sync", localTime: 12345 };
      const data = new TextEncoder().encode(JSON.stringify(msg));

      expect(timeSync.isTimeSyncMessage(data.buffer as ArrayBuffer)).toBe(true);
    });

    it("returns false for message without type", () => {
      const data = new TextEncoder().encode(JSON.stringify({ localTime: 12345 }));

      expect(timeSync.isTimeSyncMessage(data.buffer as ArrayBuffer)).toBe(false);
    });

    it("returns false for message with wrong type", () => {
      const data = new TextEncoder().encode(JSON.stringify({ type: "other", localTime: 12345 }));

      expect(timeSync.isTimeSyncMessage(data.buffer as ArrayBuffer)).toBe(false);
    });

    it("returns false for message without localTime", () => {
      const data = new TextEncoder().encode(JSON.stringify({ type: "time-sync" }));

      expect(timeSync.isTimeSyncMessage(data.buffer as ArrayBuffer)).toBe(false);
    });

    it("returns false for message with non-number localTime", () => {
      const data = new TextEncoder().encode(JSON.stringify({ type: "time-sync", localTime: "not-a-number" }));

      expect(timeSync.isTimeSyncMessage(data.buffer as ArrayBuffer)).toBe(false);
    });

    it("returns false for very large messages", () => {
      const largeData = new ArrayBuffer(200);

      expect(timeSync.isTimeSyncMessage(largeData)).toBe(false);
    });

    it("returns false for invalid JSON", () => {
      const data = new TextEncoder().encode("not valid json");

      expect(timeSync.isTimeSyncMessage(data.buffer as ArrayBuffer)).toBe(false);
    });

    it("returns false for binary data", () => {
      const data = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

      expect(timeSync.isTimeSyncMessage(data.buffer as ArrayBuffer)).toBe(false);
    });
  });

  describe("handleMessage", () => {
    it("calculates offset correctly", () => {
      const peerTime = 1000;
      const msg: TimeSyncMessage = { type: "time-sync", localTime: peerTime };
      const data = new TextEncoder().encode(JSON.stringify(msg));

      const beforeHandle = performance.now();
      const result = timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);
      const afterHandle = performance.now();

      expect(result).not.toBeNull();
      // Offset = current performance.now() - peer's localTime
      // So offset should be approximately (now - 1000)
      expect(result!.offset).toBeGreaterThanOrEqual(beforeHandle - peerTime);
      expect(result!.offset).toBeLessThanOrEqual(afterHandle - peerTime);
    });

    it("marks first message from peer as new peer", () => {
      const msg: TimeSyncMessage = { type: "time-sync", localTime: 1000 };
      const data = new TextEncoder().encode(JSON.stringify(msg));

      const result = timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);

      expect(result!.isNewPeer).toBe(true);
    });

    it("marks subsequent messages from same peer as not new", () => {
      const msg: TimeSyncMessage = { type: "time-sync", localTime: 1000 };
      const data = new TextEncoder().encode(JSON.stringify(msg));

      timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);
      const result = timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);

      expect(result!.isNewPeer).toBe(false);
    });

    it("shouldRespond is true for new peers", () => {
      const msg: TimeSyncMessage = { type: "time-sync", localTime: 1000 };
      const data = new TextEncoder().encode(JSON.stringify(msg));

      const result = timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);

      expect(result!.shouldRespond).toBe(true);
    });

    it("shouldRespond is false for known peers", () => {
      const msg: TimeSyncMessage = { type: "time-sync", localTime: 1000 };
      const data = new TextEncoder().encode(JSON.stringify(msg));

      timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);
      const result = timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);

      expect(result!.shouldRespond).toBe(false);
    });

    it("stores offset for later retrieval", () => {
      const msg: TimeSyncMessage = { type: "time-sync", localTime: 1000 };
      const data = new TextEncoder().encode(JSON.stringify(msg));

      const result = timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);

      expect(timeSync.getOffset("peer-1")).toBe(result!.offset);
    });

    it("returns null for invalid message", () => {
      const data = new TextEncoder().encode("not json");

      const result = timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);

      expect(result).toBeNull();
    });

    it("returns null for wrong message type", () => {
      const data = new TextEncoder().encode(JSON.stringify({ type: "other" }));

      const result = timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);

      expect(result).toBeNull();
    });

    it("handles multiple peers independently", () => {
      const msg1: TimeSyncMessage = { type: "time-sync", localTime: 1000 };
      const msg2: TimeSyncMessage = { type: "time-sync", localTime: 2000 };
      const data1 = new TextEncoder().encode(JSON.stringify(msg1));
      const data2 = new TextEncoder().encode(JSON.stringify(msg2));

      const result1 = timeSync.handleMessage("peer-1", data1.buffer as ArrayBuffer);
      const result2 = timeSync.handleMessage("peer-2", data2.buffer as ArrayBuffer);

      expect(result1!.isNewPeer).toBe(true);
      expect(result2!.isNewPeer).toBe(true);

      // peer-2 should have a smaller offset since its time is closer to now
      expect(timeSync.getOffset("peer-1")).toBeGreaterThan(timeSync.getOffset("peer-2"));
    });
  });

  describe("getOffset", () => {
    it("returns stored offset for known peer", () => {
      const msg: TimeSyncMessage = { type: "time-sync", localTime: 1000 };
      const data = new TextEncoder().encode(JSON.stringify(msg));

      const result = timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);

      expect(timeSync.getOffset("peer-1")).toBe(result!.offset);
    });

    it("returns 0 for unknown peer", () => {
      expect(timeSync.getOffset("unknown")).toBe(0);
    });
  });

  describe("isReady", () => {
    it("returns false for unknown peer", () => {
      expect(timeSync.isReady("unknown")).toBe(false);
    });

    it("returns true after successful sync", () => {
      const msg: TimeSyncMessage = { type: "time-sync", localTime: 1000 };
      const data = new TextEncoder().encode(JSON.stringify(msg));

      timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);

      expect(timeSync.isReady("peer-1")).toBe(true);
    });
  });

  describe("removePeer", () => {
    it("removes stored offset", () => {
      const msg: TimeSyncMessage = { type: "time-sync", localTime: 1000 };
      const data = new TextEncoder().encode(JSON.stringify(msg));

      timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);
      expect(timeSync.isReady("peer-1")).toBe(true);

      timeSync.removePeer("peer-1");

      expect(timeSync.isReady("peer-1")).toBe(false);
      expect(timeSync.getOffset("peer-1")).toBe(0);
    });

    it("does nothing for unknown peer", () => {
      // Should not throw
      timeSync.removePeer("unknown");

      expect(timeSync.isReady("unknown")).toBe(false);
    });
  });

  describe("clear", () => {
    it("removes all stored offsets", () => {
      const msg: TimeSyncMessage = { type: "time-sync", localTime: 1000 };
      const data = new TextEncoder().encode(JSON.stringify(msg));

      timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);
      timeSync.handleMessage("peer-2", data.buffer as ArrayBuffer);

      timeSync.clear();

      expect(timeSync.isReady("peer-1")).toBe(false);
      expect(timeSync.isReady("peer-2")).toBe(false);
    });
  });
});
