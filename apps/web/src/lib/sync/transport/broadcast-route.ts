/**
 * BroadcastRoute - Local tab sync via BroadcastChannel.
 *
 * Fastest transport (~1ms latency) but only works within same browser.
 * Implements the simplified Route interface.
 */

import { createLogger } from "@arnott/logger";
import type { Route, RouteState } from "./route";

const log = createLogger("sync:broadcast");

/** Generate unique tab ID */
function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Message format sent over BroadcastChannel */
interface BroadcastMessage {
  sourceTabId: string;
  payload: ArrayBuffer;
  timestamp: number;
}

export class BroadcastRoute implements Route {
  readonly type = "broadcast" as const;

  private channel: BroadcastChannel | null = null;
  private readonly tabId = generateTabId();
  private _state: RouteState = "disconnected";
  private roomId: string | null = null;

  // --- Callbacks ---
  onRawMessage: ((peerId: string, data: ArrayBuffer) => void) | null = null;
  onPeerDiscovered: ((peerId: string, isLocal: boolean) => void) | null = null;
  onPeerLost: ((peerId: string) => void) | null = null;
  onStateChange: ((state: RouteState) => void) | null = null;

  get state(): RouteState {
    return this._state;
  }

  get isSupported(): boolean {
    return typeof BroadcastChannel !== "undefined";
  }

  getLocalId(): string {
    return this.tabId;
  }

  async connect(roomId: string): Promise<void> {
    if (!this.isSupported) {
      throw new Error("BroadcastChannel not supported");
    }

    if (this._state === "connected" && this.roomId === roomId) {
      return;
    }

    // Disconnect from previous room
    await this.disconnect();

    this.roomId = roomId;
    this.setState("connecting");

    const channelName = `sync-${roomId}`;
    log.debug("Opening channel", { channelName, tabId: this.tabId });
    this.channel = new BroadcastChannel(channelName);

    this.channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      const msg = event.data;

      // Skip messages from self
      if (msg.sourceTabId === this.tabId) {
        return;
      }

      log.debug("Received message", { from: msg.sourceTabId });

      // Report peer discovery (local tabs are always "local")
      // Note: BroadcastChannel doesn't have explicit connect/disconnect
      // so we discover peers when we first hear from them
      this.onPeerDiscovered?.(msg.sourceTabId, true);

      // Report raw message
      this.onRawMessage?.(msg.sourceTabId, msg.payload);
    };

    this.channel.onmessageerror = () => {
      log.debug("Message parse error");
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

  send(target: string | "all", data: ArrayBuffer): void {
    if (this._state !== "connected" || !this.channel) {
      log.debug("Send skipped - not connected", { state: this._state });
      return;
    }

    // BroadcastChannel is always broadcast - can't target specific tabs
    // sendTo is handled by coordinator checking if target is local
    const message: BroadcastMessage = {
      sourceTabId: this.tabId,
      payload: data,
      timestamp: performance.now(),
    };

    log.debug("Sending", { tabId: this.tabId, target });
    this.channel.postMessage(message);
  }

  private setState(state: RouteState): void {
    if (this._state !== state) {
      this._state = state;
      this.onStateChange?.(state);
    }
  }
}
