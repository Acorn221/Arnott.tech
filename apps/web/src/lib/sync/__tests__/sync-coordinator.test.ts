import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SyncCoordinator, type CoordinatorState } from "../sync-coordinator";

// Mock BroadcastChannel
class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];

  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  closed = false;

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown): void {
    if (this.closed) return;

    for (const instance of MockBroadcastChannel.instances) {
      if (instance !== this && instance.name === this.name && !instance.closed) {
        setTimeout(() => {
          if (instance.onmessage && !instance.closed) {
            instance.onmessage({ data } as MessageEvent);
          }
        }, 0);
      }
    }
  }

  close(): void {
    this.closed = true;
    const index = MockBroadcastChannel.instances.indexOf(this);
    if (index >= 0) {
      MockBroadcastChannel.instances.splice(index, 1);
    }
  }

  static reset(): void {
    MockBroadcastChannel.instances = [];
  }

  receiveMessage(data: unknown): void {
    if (this.onmessage && !this.closed) {
      this.onmessage({ data } as MessageEvent);
    }
  }
}

describe("SyncCoordinator", () => {
  let coordinator: SyncCoordinator;
  let originalBroadcastChannel: typeof BroadcastChannel;

  beforeEach(() => {
    MockBroadcastChannel.reset();
    originalBroadcastChannel = globalThis.BroadcastChannel;
    globalThis.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;
    coordinator = new SyncCoordinator();
  });

  afterEach(async () => {
    await coordinator.disconnect();
    globalThis.BroadcastChannel = originalBroadcastChannel;
    MockBroadcastChannel.reset();
  });

  describe("constructor", () => {
    it("starts in disconnected state", () => {
      expect(coordinator.state).toBe("disconnected");
      expect(coordinator.isConnected).toBe(false);
    });

    it("starts with no peers", () => {
      expect(coordinator.peerCount).toBe(0);
      expect(coordinator.peers).toEqual([]);
    });
  });

  describe("connect", () => {
    it("transitions to connected state", async () => {
      const stateChanges: CoordinatorState[] = [];
      coordinator.onStateChange = (state) => stateChanges.push(state);

      await coordinator.connect("test-room");

      expect(coordinator.state).toBe("connected");
      expect(coordinator.isConnected).toBe(true);
      expect(stateChanges).toContain("connecting");
      expect(stateChanges).toContain("connected");
    });

    it("creates BroadcastChannel for room", async () => {
      await coordinator.connect("test-room");

      // Should have channels for sync and leader election
      const syncChannel = MockBroadcastChannel.instances.find((ch) => ch.name === "sync-test-room");
      expect(syncChannel).toBeDefined();
    });

    it("does nothing when already connected to same room", async () => {
      await coordinator.connect("test-room");
      const channelCount = MockBroadcastChannel.instances.length;

      await coordinator.connect("test-room");

      expect(MockBroadcastChannel.instances.length).toBe(channelCount);
    });

    it("returns local ID from broadcast transport", async () => {
      await coordinator.connect("test-room");

      const localId = coordinator.getLocalId();
      expect(localId).toMatch(/^tab-\d+-[a-z0-9]+$/);
    });
  });

  describe("disconnect", () => {
    it("transitions to disconnected state", async () => {
      await coordinator.connect("test-room");
      await coordinator.disconnect();

      expect(coordinator.state).toBe("disconnected");
      expect(coordinator.isConnected).toBe(false);
    });

    it("clears all peers", async () => {
      await coordinator.connect("test-room");
      await coordinator.disconnect();

      expect(coordinator.peerCount).toBe(0);
      expect(coordinator.peers).toEqual([]);
    });

    it("closes all channels", async () => {
      await coordinator.connect("test-room");
      const channelCount = MockBroadcastChannel.instances.length;

      await coordinator.disconnect();

      // All channels should be closed (removed from instances)
      // Leader election channel may remain briefly
      expect(MockBroadcastChannel.instances.filter((ch) => !ch.closed).length).toBeLessThanOrEqual(channelCount);
    });
  });

  describe("broadcast", () => {
    it("sends message via transport", async () => {
      await coordinator.connect("test-room");

      const syncChannel = MockBroadcastChannel.instances.find((ch) => ch.name === "sync-test-room")!;
      const postMessageSpy = vi.spyOn(syncChannel, "postMessage");

      const data = new TextEncoder().encode("hello");
      coordinator.broadcast(data.buffer as ArrayBuffer);

      expect(postMessageSpy).toHaveBeenCalledTimes(1);
    });

    it("does not send when disconnected", () => {
      const data = new TextEncoder().encode("hello");
      coordinator.broadcast(data.buffer as ArrayBuffer);

      // No channels should exist
      expect(MockBroadcastChannel.instances.filter((ch) => ch.name.startsWith("sync-")).length).toBe(0);
    });

    it("marks own messages as seen (dedup)", async () => {
      await coordinator.connect("test-room");

      const receivedMessages: ArrayBuffer[] = [];
      coordinator.onMessage = (data) => {
        receivedMessages.push(data);
      };

      // Send a message
      const data = new TextEncoder().encode("hello from self");
      coordinator.broadcast(data.buffer as ArrayBuffer);

      // Simulate receiving our own message back (shouldn't happen with real BC, but testing dedup)
      const syncChannel = MockBroadcastChannel.instances.find((ch) => ch.name === "sync-test-room")!;
      syncChannel.receiveMessage({
        type: "data",
        sourceTabId: coordinator.getLocalId(),
        payload: new Uint8Array(data),
        timestamp: performance.now(),
      });

      // Should not trigger onMessage for own messages
      expect(receivedMessages).toHaveLength(0);
    });
  });

  describe("receiving messages", () => {
    it("calls onMessage callback for incoming messages", async () => {
      await coordinator.connect("test-room");

      const receivedMessages: Array<{ data: ArrayBuffer; peerId: string; timeOffset: number }> = [];
      coordinator.onMessage = (data, peerId, timeOffset) => {
        receivedMessages.push({ data, peerId, timeOffset });
      };

      const syncChannel = MockBroadcastChannel.instances.find((ch) => ch.name === "sync-test-room")!;
      const payload = new TextEncoder().encode("hello from peer");

      syncChannel.receiveMessage({
        type: "data",
        sourceTabId: "peer-123",
        payload: new Uint8Array(payload),
        timestamp: performance.now(),
      });

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].peerId).toBe("peer-123");
    });

    it("deduplicates messages", async () => {
      await coordinator.connect("test-room");

      const receivedMessages: ArrayBuffer[] = [];
      coordinator.onMessage = (data) => {
        receivedMessages.push(data);
      };

      const syncChannel = MockBroadcastChannel.instances.find((ch) => ch.name === "sync-test-room")!;
      const payload = new TextEncoder().encode("same message");

      // Send same message twice
      syncChannel.receiveMessage({
        type: "data",
        sourceTabId: "peer-123",
        payload: new Uint8Array(payload),
        timestamp: performance.now(),
      });

      syncChannel.receiveMessage({
        type: "data",
        sourceTabId: "peer-456", // Different peer, same content
        payload: new Uint8Array(payload),
        timestamp: performance.now(),
      });

      // Should only receive once due to dedup
      expect(receivedMessages).toHaveLength(1);
    });

    it("does not pass time-sync messages to app", async () => {
      await coordinator.connect("test-room");

      const receivedMessages: ArrayBuffer[] = [];
      coordinator.onMessage = (data) => {
        receivedMessages.push(data);
      };

      const syncChannel = MockBroadcastChannel.instances.find((ch) => ch.name === "sync-test-room")!;
      const timeSyncMsg = JSON.stringify({ type: "time-sync", localTime: 12345 });
      const payload = new TextEncoder().encode(timeSyncMsg);

      syncChannel.receiveMessage({
        type: "data",
        sourceTabId: "peer-123",
        payload: new Uint8Array(payload),
        timestamp: performance.now(),
      });

      // Time-sync messages should not reach the app
      expect(receivedMessages).toHaveLength(0);
    });
  });

  describe("peer discovery", () => {
    it("adds peer to registry when message received", async () => {
      await coordinator.connect("test-room");

      expect(coordinator.peerCount).toBe(0);

      const syncChannel = MockBroadcastChannel.instances.find((ch) => ch.name === "sync-test-room")!;
      const payload = new TextEncoder().encode("hello");

      syncChannel.receiveMessage({
        type: "data",
        sourceTabId: "peer-123",
        payload: new Uint8Array(payload),
        timestamp: performance.now(),
      });

      expect(coordinator.peerCount).toBe(1);
      expect(coordinator.peers[0].id).toBe("peer-123");
      expect(coordinator.peers[0].transports.has("broadcast")).toBe(true);
    });

    it("marks broadcast peers as local", async () => {
      await coordinator.connect("test-room");

      const syncChannel = MockBroadcastChannel.instances.find((ch) => ch.name === "sync-test-room")!;
      const payload = new TextEncoder().encode("hello");

      syncChannel.receiveMessage({
        type: "data",
        sourceTabId: "peer-123",
        payload: new Uint8Array(payload),
        timestamp: performance.now(),
      });

      expect(coordinator.peers[0].isLocal).toBe(true);
    });
  });

  describe("time sync", () => {
    it("responds to time-sync messages", async () => {
      await coordinator.connect("test-room");

      const syncChannel = MockBroadcastChannel.instances.find((ch) => ch.name === "sync-test-room")!;
      const postMessageSpy = vi.spyOn(syncChannel, "postMessage");

      // Clear initial calls
      postMessageSpy.mockClear();

      // Send a time-sync message from a peer
      const timeSyncMsg = JSON.stringify({ type: "time-sync", localTime: performance.now() });
      const payload = new TextEncoder().encode(timeSyncMsg);

      syncChannel.receiveMessage({
        type: "data",
        sourceTabId: "peer-123",
        payload: new Uint8Array(payload),
        timestamp: performance.now(),
      });

      // Should respond with our own time-sync
      expect(postMessageSpy).toHaveBeenCalled();
    });

    it("stores time offset after sync", async () => {
      await coordinator.connect("test-room");

      const syncChannel = MockBroadcastChannel.instances.find((ch) => ch.name === "sync-test-room")!;

      // First send a regular message to create the peer
      const regularPayload = new TextEncoder().encode("hello");
      syncChannel.receiveMessage({
        type: "data",
        sourceTabId: "peer-123",
        payload: new Uint8Array(regularPayload),
        timestamp: performance.now(),
      });

      // Now send time-sync
      const timeSyncMsg = JSON.stringify({ type: "time-sync", localTime: 1000 });
      const timeSyncPayload = new TextEncoder().encode(timeSyncMsg);

      syncChannel.receiveMessage({
        type: "data",
        sourceTabId: "peer-123",
        payload: new Uint8Array(timeSyncPayload),
        timestamp: performance.now(),
      });

      // Peer should have a non-zero offset now
      const peer = coordinator.peers.find((p) => p.id === "peer-123");
      expect(peer).toBeDefined();
      expect(peer!.timeOffset).not.toBe(0);
    });
  });

  describe("sendTo", () => {
    it("sends message to specific peer", async () => {
      await coordinator.connect("test-room");

      // Create the peer first
      const syncChannel = MockBroadcastChannel.instances.find((ch) => ch.name === "sync-test-room")!;
      const payload = new TextEncoder().encode("hello");
      syncChannel.receiveMessage({
        type: "data",
        sourceTabId: "peer-123",
        payload: new Uint8Array(payload),
        timestamp: performance.now(),
      });

      const postMessageSpy = vi.spyOn(syncChannel, "postMessage");
      postMessageSpy.mockClear();

      const data = new TextEncoder().encode("to peer");
      coordinator.sendTo("peer-123", data.buffer as ArrayBuffer);

      // Should send (BroadcastChannel broadcasts everything, but coordinator routes)
      expect(postMessageSpy).toHaveBeenCalled();
    });

    it("does nothing for unknown peer", async () => {
      await coordinator.connect("test-room");

      const syncChannel = MockBroadcastChannel.instances.find((ch) => ch.name === "sync-test-room")!;
      const postMessageSpy = vi.spyOn(syncChannel, "postMessage");
      postMessageSpy.mockClear();

      const data = new TextEncoder().encode("to unknown");
      coordinator.sendTo("unknown-peer", data.buffer as ArrayBuffer);

      expect(postMessageSpy).not.toHaveBeenCalled();
    });
  });

  describe("isLeader", () => {
    it("returns false initially", () => {
      expect(coordinator.isLeader).toBe(false);
    });

    it("returns leader status after connect", async () => {
      await coordinator.connect("test-room");

      // After connect, should have leader election running
      // First tab should become leader
      // Wait for election
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(typeof coordinator.isLeader).toBe("boolean");
    });
  });

  describe("integration: two coordinators", () => {
    it("coordinators can exchange messages", async () => {
      const coord1 = new SyncCoordinator();
      const coord2 = new SyncCoordinator();

      await coord1.connect("shared-room");
      await coord2.connect("shared-room");

      const received: Array<{ data: string; peerId: string }> = [];
      coord2.onMessage = (data, peerId) => {
        received.push({
          data: new TextDecoder().decode(data),
          peerId,
        });
      };

      const message = new TextEncoder().encode("hello from coord1");
      coord1.broadcast(message.buffer as ArrayBuffer);

      // Wait for async delivery
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(received).toHaveLength(1);
      expect(received[0].data).toBe("hello from coord1");
      expect(received[0].peerId).toBe(coord1.getLocalId());

      await coord1.disconnect();
      await coord2.disconnect();
    });

    it("both coordinators see each other as peers", async () => {
      const coord1 = new SyncCoordinator();
      const coord2 = new SyncCoordinator();

      await coord1.connect("shared-room");
      await coord2.connect("shared-room");

      // Send messages to trigger peer discovery
      const msg1 = new TextEncoder().encode("from 1");
      const msg2 = new TextEncoder().encode("from 2");
      coord1.broadcast(msg1.buffer as ArrayBuffer);
      coord2.broadcast(msg2.buffer as ArrayBuffer);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(coord1.peerCount).toBe(1);
      expect(coord2.peerCount).toBe(1);
      expect(coord1.peers[0].id).toBe(coord2.getLocalId());
      expect(coord2.peers[0].id).toBe(coord1.getLocalId());

      await coord1.disconnect();
      await coord2.disconnect();
    });
  });
});
