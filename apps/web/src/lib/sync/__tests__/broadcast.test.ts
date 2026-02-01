import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import { BroadcastTransport } from "../transports/broadcast";
import type { TransportState } from "../interfaces/types";

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

    // Deliver to other instances with same channel name
    for (const instance of MockBroadcastChannel.instances) {
      if (instance !== this && instance.name === this.name && !instance.closed) {
        // Simulate async delivery
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

  // Helper to simulate receiving a message directly
  receiveMessage(data: unknown): void {
    if (this.onmessage && !this.closed) {
      this.onmessage({ data } as MessageEvent);
    }
  }
}

describe("BroadcastTransport", () => {
  let transport: BroadcastTransport;
  let originalBroadcastChannel: typeof BroadcastChannel;

  beforeEach(() => {
    MockBroadcastChannel.reset();
    originalBroadcastChannel = globalThis.BroadcastChannel;
    globalThis.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;
    transport = new BroadcastTransport();
  });

  afterEach(async () => {
    await transport.disconnect();
    globalThis.BroadcastChannel = originalBroadcastChannel;
    MockBroadcastChannel.reset();
  });

  describe("constructor", () => {
    it("starts in disconnected state", () => {
      expect(transport.state).toBe("disconnected");
    });

    it("has type broadcast", () => {
      expect(transport.type).toBe("broadcast");
    });

    it("generates a unique tab ID", () => {
      const transport2 = new BroadcastTransport();
      expect(transport.getLocalId()).not.toBe(transport2.getLocalId());
      expect(transport.getLocalId()).toMatch(/^tab-\d+-[a-z0-9]+$/);
    });
  });

  describe("isSupported", () => {
    it("returns true when BroadcastChannel is available", () => {
      expect(transport.isSupported).toBe(true);
    });

    it("returns false when BroadcastChannel is undefined", () => {
      const saved = globalThis.BroadcastChannel;
      // @ts-ignore - intentionally setting to undefined
      globalThis.BroadcastChannel = undefined;

      const newTransport = new BroadcastTransport();
      expect(newTransport.isSupported).toBe(false);

      globalThis.BroadcastChannel = saved;
    });
  });

  describe("connect", () => {
    it("sets state to connected", async () => {
      await transport.connect({ roomId: "test-room" });

      expect(transport.state).toBe("connected");
    });

    it("fires onStateChange callback", async () => {
      const stateChanges: TransportState[] = [];
      transport.onStateChange = (state) => stateChanges.push(state);

      await transport.connect({ roomId: "test-room" });

      expect(stateChanges).toContain("connecting");
      expect(stateChanges).toContain("connected");
    });

    it("opens BroadcastChannel with correct name", async () => {
      await transport.connect({ roomId: "test-room" });

      expect(MockBroadcastChannel.instances).toHaveLength(1);
      expect(MockBroadcastChannel.instances[0].name).toBe("sync-test-room");
    });

    it("reconnects when called with different room", async () => {
      await transport.connect({ roomId: "room-1" });
      expect(MockBroadcastChannel.instances[0].name).toBe("sync-room-1");

      await transport.connect({ roomId: "room-2" });
      expect(MockBroadcastChannel.instances[0].name).toBe("sync-room-2");
    });

    it("does nothing when already connected to same room", async () => {
      await transport.connect({ roomId: "test-room" });
      const firstInstance = MockBroadcastChannel.instances[0];

      await transport.connect({ roomId: "test-room" });

      expect(MockBroadcastChannel.instances[0]).toBe(firstInstance);
    });
  });

  describe("disconnect", () => {
    it("sets state to disconnected", async () => {
      await transport.connect({ roomId: "test-room" });
      await transport.disconnect();

      expect(transport.state).toBe("disconnected");
    });

    it("closes the BroadcastChannel", async () => {
      await transport.connect({ roomId: "test-room" });
      const channel = MockBroadcastChannel.instances[0];

      await transport.disconnect();

      expect(channel.closed).toBe(true);
    });

    it("fires onStateChange callback", async () => {
      await transport.connect({ roomId: "test-room" });

      const stateChanges: TransportState[] = [];
      transport.onStateChange = (state) => stateChanges.push(state);

      await transport.disconnect();

      expect(stateChanges).toContain("disconnected");
    });
  });

  describe("broadcast", () => {
    it("sends message to BroadcastChannel", async () => {
      await transport.connect({ roomId: "test-room" });

      const postMessageSpy = vi.spyOn(MockBroadcastChannel.instances[0], "postMessage");

      const data = new TextEncoder().encode("test message");
      transport.broadcast(data.buffer as ArrayBuffer);

      expect(postMessageSpy).toHaveBeenCalledTimes(1);
      const sentMessage = postMessageSpy.mock.calls[0][0] as {
        sourceTabId: string;
        payload: Uint8Array;
        timestamp: number;
      };
      expect(sentMessage.sourceTabId).toBe(transport.getLocalId());
      expect(sentMessage.payload).toBeInstanceOf(Uint8Array);
    });

    it("does not send when not connected", () => {
      const data = new TextEncoder().encode("test");
      transport.broadcast(data.buffer as ArrayBuffer);

      expect(MockBroadcastChannel.instances).toHaveLength(0);
    });
  });

  describe("send (to specific peer)", () => {
    it("broadcasts since BroadcastChannel cannot target peers", async () => {
      await transport.connect({ roomId: "test-room" });

      const postMessageSpy = vi.spyOn(MockBroadcastChannel.instances[0], "postMessage");

      const data = new TextEncoder().encode("test message");
      transport.send("peer-1", data.buffer as ArrayBuffer);

      expect(postMessageSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("receiving messages", () => {
    it("calls onReceive when message received from another tab", async () => {
      await transport.connect({ roomId: "test-room" });

      const receivedMessages: Array<{ peerId: string; data: ArrayBuffer }> = [];
      transport.onReceive = (peerId, data) => {
        receivedMessages.push({ peerId, data });
      };

      const channel = MockBroadcastChannel.instances[0];
      const payload = new TextEncoder().encode("hello");
      channel.receiveMessage({
        type: "data",
        sourceTabId: "other-tab-123",
        payload: new Uint8Array(payload),
        timestamp: 12345,
      });

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].peerId).toBe("other-tab-123");
    });

    it("calls onPeerReachable when message received", async () => {
      await transport.connect({ roomId: "test-room" });

      const reachablePeers: Array<{ peerId: string; isLocal: boolean }> = [];
      transport.onPeerReachable = (peerId, isLocal) => {
        reachablePeers.push({ peerId, isLocal });
      };

      const channel = MockBroadcastChannel.instances[0];
      channel.receiveMessage({
        type: "data",
        sourceTabId: "other-tab-456",
        payload: new Uint8Array([1, 2, 3]),
        timestamp: 12345,
      });

      expect(reachablePeers).toHaveLength(1);
      expect(reachablePeers[0].peerId).toBe("other-tab-456");
      expect(reachablePeers[0].isLocal).toBe(true); // broadcast peers are always local
    });

    it("ignores messages from self", async () => {
      await transport.connect({ roomId: "test-room" });

      const receivedMessages: Array<{ peerId: string; data: ArrayBuffer }> = [];
      transport.onReceive = (peerId, data) => {
        receivedMessages.push({ peerId, data });
      };

      const channel = MockBroadcastChannel.instances[0];
      channel.receiveMessage({
        type: "data",
        sourceTabId: transport.getLocalId(), // Self
        payload: new Uint8Array([1, 2, 3]),
        timestamp: 12345,
      });

      expect(receivedMessages).toHaveLength(0);
    });

    it("ignores invalid message format", async () => {
      await transport.connect({ roomId: "test-room" });

      const receivedMessages: Array<{ peerId: string; data: ArrayBuffer }> = [];
      transport.onReceive = (peerId, data) => {
        receivedMessages.push({ peerId, data });
      };

      const channel = MockBroadcastChannel.instances[0];

      // Missing sourceTabId
      channel.receiveMessage({ type: "data", payload: new Uint8Array([1]) });
      // Missing payload
      channel.receiveMessage({ type: "data", sourceTabId: "peer-1" });
      // Missing type
      channel.receiveMessage({ sourceTabId: "peer-1", payload: new Uint8Array([1]) });
      // Null message
      channel.receiveMessage(null);

      expect(receivedMessages).toHaveLength(0);
    });
  });

  describe("getLocalId", () => {
    it("returns consistent tab ID", () => {
      const id1 = transport.getLocalId();
      const id2 = transport.getLocalId();

      expect(id1).toBe(id2);
    });

    it("returns ID matching tab pattern", () => {
      expect(transport.getLocalId()).toMatch(/^tab-\d+-[a-z0-9]+$/);
    });
  });

  describe("inter-tab communication", () => {
    it("allows two transports to communicate", async () => {
      const transport1 = new BroadcastTransport();
      const transport2 = new BroadcastTransport();

      await transport1.connect({ roomId: "shared-room" });
      await transport2.connect({ roomId: "shared-room" });

      const received: Array<{ peerId: string; data: ArrayBuffer }> = [];
      transport2.onReceive = (peerId, data) => {
        received.push({ peerId, data });
      };

      const testData = new TextEncoder().encode("hello from tab 1");
      transport1.broadcast(testData.buffer as ArrayBuffer);

      // Wait for async delivery
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(received).toHaveLength(1);
      expect(received[0].peerId).toBe(transport1.getLocalId());

      await transport1.disconnect();
      await transport2.disconnect();
    });
  });
});
