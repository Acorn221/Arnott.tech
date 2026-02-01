/**
 * BroadcastChannel transport for instant same-browser tab sync.
 * Fastest transport (~1ms latency) but only works within same browser.
 */

import type { Transport, TransportState, SyncMessage } from "./types";

/** Generate unique tab ID */
function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Message format sent over BroadcastChannel */
interface BroadcastMessage {
  sourceTabId: string;
  payload: ArrayBuffer | string;
  timestamp: number;
}

export class BroadcastTransport implements Transport {
  readonly name = "broadcast" as const;

  private channel: BroadcastChannel | null = null;
  private readonly tabId = generateTabId();
  private _state: TransportState = "disconnected";
  private roomId: string | null = null;

  // Callbacks
  onMessage: ((message: SyncMessage) => void) | null = null;
  onStateChange: ((state: TransportState) => void) | null = null;
  onPeerConnect: ((peerId: string) => void) | null = null;
  onPeerDisconnect: ((peerId: string) => void) | null = null;

  get state(): TransportState {
    return this._state;
  }

  get isSupported(): boolean {
    return typeof BroadcastChannel !== "undefined";
  }

  /** Get this tab's unique ID */
  getTabId(): string {
    return this.tabId;
  }

  async connect(roomId: string): Promise<void> {
    if (!this.isSupported) {
      throw new Error("BroadcastChannel not supported");
    }

    if (this._state === "connected" && this.roomId === roomId) {
      return; // Already connected to this room
    }

    // Disconnect from previous room if any
    await this.disconnect();

    this.roomId = roomId;
    this.setState("connecting");

    this.channel = new BroadcastChannel(`sync-${roomId}`);

    this.channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      const msg = event.data;

      // Skip messages from self
      if (msg.sourceTabId === this.tabId) {
        return;
      }

      this.onMessage?.({
        data: msg.payload,
        source: {
          transport: "broadcast",
          peerId: msg.sourceTabId,
          isLocalTab: true,
          timeOffset: 0, // Same device = no clock skew
        },
        receivedAt: performance.now(),
      });
    };

    this.channel.onmessageerror = () => {
      // Message parsing failed - ignore
    };

    this.setState("connected");
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.roomId = null;
    this.setState("disconnected");
  }

  broadcast(data: ArrayBuffer | string): void {
    if (this._state !== "connected" || !this.channel) {
      return;
    }

    const message: BroadcastMessage = {
      sourceTabId: this.tabId,
      payload: data,
      timestamp: performance.now(),
    };

    this.channel.postMessage(message);
  }

  private setState(state: TransportState): void {
    if (this._state !== state) {
      this._state = state;
      this.onStateChange?.(state);
    }
  }
}
