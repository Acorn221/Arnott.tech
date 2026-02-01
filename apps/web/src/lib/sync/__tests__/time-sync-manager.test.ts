import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TimeSyncManager, type TimeSyncRequest, type TimeSyncResponse } from "../time-sync-manager";

describe("TimeSyncManager", () => {
  let timeSync: TimeSyncManager;

  beforeEach(() => {
    timeSync = new TimeSyncManager();
  });

  describe("createSyncRequest", () => {
    it("returns an ArrayBuffer", () => {
      const msg = timeSync.createSyncRequest();

      expect(msg).toBeInstanceOf(ArrayBuffer);
    });

    it("contains valid JSON with type and requestTime", () => {
      const msg = timeSync.createSyncRequest();
      const text = new TextDecoder().decode(msg);
      const parsed = JSON.parse(text) as TimeSyncRequest;

      expect(parsed.type).toBe("time-sync-request");
      expect(typeof parsed.requestTime).toBe("number");
    });

    it("uses current performance.now() for requestTime", () => {
      const before = performance.now();
      const msg = timeSync.createSyncRequest();
      const after = performance.now();

      const text = new TextDecoder().decode(msg);
      const parsed = JSON.parse(text) as TimeSyncRequest;

      expect(parsed.requestTime).toBeGreaterThanOrEqual(before);
      expect(parsed.requestTime).toBeLessThanOrEqual(after);
    });

    it("stores pending request when peerId is provided", () => {
      const msg = timeSync.createSyncRequest("peer-1");

      expect(msg).toBeInstanceOf(ArrayBuffer);
      // The request should be stored internally for RTT calculation
      // We can verify this by sending a response
    });
  });

  describe("createSyncMessage (alias)", () => {
    it("returns same result as createSyncRequest", () => {
      const msg1 = timeSync.createSyncMessage();
      const msg2 = timeSync.createSyncRequest();

      const text1 = new TextDecoder().decode(msg1);
      const text2 = new TextDecoder().decode(msg2);

      const parsed1 = JSON.parse(text1);
      const parsed2 = JSON.parse(text2);

      expect(parsed1.type).toBe(parsed2.type);
    });
  });

  describe("isTimeSyncMessage", () => {
    it("returns true for valid time-sync-request message", () => {
      const msg: TimeSyncRequest = { type: "time-sync-request", requestTime: 12345 };
      const data = new TextEncoder().encode(JSON.stringify(msg));

      expect(timeSync.isTimeSyncMessage(data.buffer as ArrayBuffer)).toBe(true);
    });

    it("returns true for valid time-sync-response message", () => {
      const msg: TimeSyncResponse = { type: "time-sync-response", requestTime: 12345, responseTime: 12400 };
      const data = new TextEncoder().encode(JSON.stringify(msg));

      expect(timeSync.isTimeSyncMessage(data.buffer as ArrayBuffer)).toBe(true);
    });

    it("returns true for legacy time-sync message", () => {
      const msg = { type: "time-sync", localTime: 12345 };
      const data = new TextEncoder().encode(JSON.stringify(msg));

      expect(timeSync.isTimeSyncMessage(data.buffer as ArrayBuffer)).toBe(true);
    });

    it("returns false for message without type", () => {
      const data = new TextEncoder().encode(JSON.stringify({ requestTime: 12345 }));

      expect(timeSync.isTimeSyncMessage(data.buffer as ArrayBuffer)).toBe(false);
    });

    it("returns false for message with wrong type", () => {
      const data = new TextEncoder().encode(JSON.stringify({ type: "other", requestTime: 12345 }));

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

  describe("handleMessage - request/response flow", () => {
    it("responds to sync request with a response", () => {
      const request: TimeSyncRequest = { type: "time-sync-request", requestTime: 1000 };
      const data = new TextEncoder().encode(JSON.stringify(request));

      const result = timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);

      expect(result).not.toBeNull();
      expect(result!.responseMessage).not.toBeNull();

      // Verify the response format
      const responseText = new TextDecoder().decode(result!.responseMessage!);
      const response = JSON.parse(responseText) as TimeSyncResponse;

      expect(response.type).toBe("time-sync-response");
      expect(response.requestTime).toBe(1000); // Echoed
      expect(typeof response.responseTime).toBe("number");
    });

    it("calculates RTT-compensated offset from response", () => {
      const peerId = "peer-1";

      // Step 1: Create request (stores requestTime internally)
      timeSync.createSyncRequest(peerId);
      const requestTime = performance.now() - 10; // Simulate request was sent 10ms ago

      // Step 2: Simulate receiving response
      const responseTime = requestTime + 5; // Peer received and responded 5ms after we sent
      const response: TimeSyncResponse = {
        type: "time-sync-response",
        requestTime: requestTime,
        responseTime: responseTime,
      };
      const data = new TextEncoder().encode(JSON.stringify(response));

      const result = timeSync.handleMessage(peerId, data.buffer as ArrayBuffer);

      expect(result).not.toBeNull();
      expect(result!.isNewPeer).toBe(true);
      expect(result!.responseMessage).toBeNull(); // No response needed for response message

      // The offset should be calculated using RTT compensation
      // RTT = receiveTime - requestTime
      // offset = receiveTime - responseTime - RTT/2
      expect(typeof result!.offset).toBe("number");
    });

    it("marks first sync with peer as new peer", () => {
      // Complete a full request/response cycle
      const peerId = "peer-1";

      // Receive request
      const request: TimeSyncRequest = { type: "time-sync-request", requestTime: 1000 };
      const requestData = new TextEncoder().encode(JSON.stringify(request));
      const requestResult = timeSync.handleMessage(peerId, requestData.buffer as ArrayBuffer);

      expect(requestResult!.isNewPeer).toBe(true);
    });

    it("marks subsequent syncs as not new peer", () => {
      const peerId = "peer-1";

      // First request
      const request: TimeSyncRequest = { type: "time-sync-request", requestTime: 1000 };
      const data = new TextEncoder().encode(JSON.stringify(request));
      timeSync.handleMessage(peerId, data.buffer as ArrayBuffer);

      // Complete RTT sync with a response
      const response: TimeSyncResponse = {
        type: "time-sync-response",
        requestTime: performance.now(),
        responseTime: performance.now() + 5,
      };
      const responseData = new TextEncoder().encode(JSON.stringify(response));
      timeSync.handleMessage(peerId, responseData.buffer as ArrayBuffer);

      // Second request from same peer
      const request2: TimeSyncRequest = { type: "time-sync-request", requestTime: 2000 };
      const data2 = new TextEncoder().encode(JSON.stringify(request2));
      const result2 = timeSync.handleMessage(peerId, data2.buffer as ArrayBuffer);

      expect(result2!.isNewPeer).toBe(false);
    });

    it("stores offset for later retrieval", () => {
      const peerId = "peer-1";

      // Create and handle a response (to complete RTT sync)
      timeSync.createSyncRequest(peerId);
      const requestTime = performance.now();

      const response: TimeSyncResponse = {
        type: "time-sync-response",
        requestTime: requestTime,
        responseTime: requestTime + 10,
      };
      const data = new TextEncoder().encode(JSON.stringify(response));
      const result = timeSync.handleMessage(peerId, data.buffer as ArrayBuffer);

      expect(timeSync.getOffset(peerId)).toBe(result!.offset);
      expect(timeSync.isReady(peerId)).toBe(true);
    });
  });

  describe("handleMessage - legacy support", () => {
    it("handles legacy time-sync messages", () => {
      const msg = { type: "time-sync", localTime: 1000 };
      const data = new TextEncoder().encode(JSON.stringify(msg));

      const result = timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);

      expect(result).not.toBeNull();
      expect(result!.isNewPeer).toBe(true);
      // Legacy handler should respond with a new-style request
      expect(result!.responseMessage).not.toBeNull();
    });

    it("calculates offset for legacy messages", () => {
      const peerTime = 1000;
      const msg = { type: "time-sync", localTime: peerTime };
      const data = new TextEncoder().encode(JSON.stringify(msg));

      const beforeHandle = performance.now();
      const result = timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);
      const afterHandle = performance.now();

      expect(result).not.toBeNull();
      // Legacy offset = current time - peer's localTime
      expect(result!.offset).toBeGreaterThanOrEqual(beforeHandle - peerTime);
      expect(result!.offset).toBeLessThanOrEqual(afterHandle - peerTime);
    });
  });

  describe("handleMessage - error cases", () => {
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
  });

  describe("getOffset", () => {
    it("returns stored offset for known peer", () => {
      const peerId = "peer-1";
      timeSync.createSyncRequest(peerId);

      const response: TimeSyncResponse = {
        type: "time-sync-response",
        requestTime: performance.now(),
        responseTime: performance.now() + 5,
      };
      const data = new TextEncoder().encode(JSON.stringify(response));
      const result = timeSync.handleMessage(peerId, data.buffer as ArrayBuffer);

      expect(timeSync.getOffset(peerId)).toBe(result!.offset);
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
      const peerId = "peer-1";
      timeSync.createSyncRequest(peerId);

      const response: TimeSyncResponse = {
        type: "time-sync-response",
        requestTime: performance.now(),
        responseTime: performance.now() + 5,
      };
      const data = new TextEncoder().encode(JSON.stringify(response));
      timeSync.handleMessage(peerId, data.buffer as ArrayBuffer);

      expect(timeSync.isReady(peerId)).toBe(true);
    });
  });

  describe("removePeer", () => {
    it("removes stored offset", () => {
      const peerId = "peer-1";
      timeSync.createSyncRequest(peerId);

      const response: TimeSyncResponse = {
        type: "time-sync-response",
        requestTime: performance.now(),
        responseTime: performance.now() + 5,
      };
      const data = new TextEncoder().encode(JSON.stringify(response));
      timeSync.handleMessage(peerId, data.buffer as ArrayBuffer);

      expect(timeSync.isReady(peerId)).toBe(true);

      timeSync.removePeer(peerId);

      expect(timeSync.isReady(peerId)).toBe(false);
      expect(timeSync.getOffset(peerId)).toBe(0);
    });

    it("does nothing for unknown peer", () => {
      // Should not throw
      timeSync.removePeer("unknown");

      expect(timeSync.isReady("unknown")).toBe(false);
    });
  });

  describe("clear", () => {
    it("removes all stored offsets", () => {
      // Sync with two peers
      const request: TimeSyncRequest = { type: "time-sync-request", requestTime: 1000 };
      const data = new TextEncoder().encode(JSON.stringify(request));

      timeSync.handleMessage("peer-1", data.buffer as ArrayBuffer);
      timeSync.handleMessage("peer-2", data.buffer as ArrayBuffer);

      timeSync.clear();

      expect(timeSync.isReady("peer-1")).toBe(false);
      expect(timeSync.isReady("peer-2")).toBe(false);
    });
  });

  describe("RTT-based offset calculation", () => {
    it("correctly compensates for network latency", () => {
      const peerId = "peer-1";

      // Simulate a scenario with known timing:
      // - We send request at T=100
      // - Peer receives at T=150 (50ms one-way latency + clock diff)
      // - Peer responds at T=150
      // - We receive at T=200 (50ms return + clock diff cancels)

      // The offset should eliminate network latency
      // offset = receiveTime - responseTime - RTT/2
      // If clocks are synced and latency is symmetric:
      // offset should be close to 0

      // In this test, we'll verify the formula is applied correctly
      const requestTime = 100;
      const responseTime = 150;
      // Simulate receiving the response
      const receiveTimeBeforeResult = performance.now();

      const response: TimeSyncResponse = {
        type: "time-sync-response",
        requestTime: requestTime,
        responseTime: responseTime,
      };
      const data = new TextEncoder().encode(JSON.stringify(response));
      const result = timeSync.handleMessage(peerId, data.buffer as ArrayBuffer);

      const receiveTimeAfterResult = performance.now();

      expect(result).not.toBeNull();

      // The offset calculation:
      // RTT = receiveTime - requestTime
      // oneWayLatency = RTT / 2
      // offset = receiveTime - responseTime - oneWayLatency + LATENCY_BUFFER
      // where LATENCY_BUFFER = 50ms

      // We can verify bounds:
      // RTT is at least (receiveTimeBefore - requestTime)
      // RTT is at most (receiveTimeAfter - requestTime)
      const LATENCY_BUFFER = 50;
      const minRTT = receiveTimeBeforeResult - requestTime;
      const maxRTT = receiveTimeAfterResult - requestTime;

      const minExpectedOffset = receiveTimeBeforeResult - responseTime - maxRTT / 2 + LATENCY_BUFFER;
      const maxExpectedOffset = receiveTimeAfterResult - responseTime - minRTT / 2 + LATENCY_BUFFER;

      expect(result!.offset).toBeGreaterThanOrEqual(minExpectedOffset);
      expect(result!.offset).toBeLessThanOrEqual(maxExpectedOffset);
    });
  });
});
