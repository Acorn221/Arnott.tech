/**
 * BroadcastTransport - Local tab sync via BroadcastChannel.
 *
 * Fastest transport (~1ms latency) but only works within same browser.
 * Implements the ITransport interface.
 *
 * Key characteristics:
 * - All messages are broadcast to all tabs (no peer-specific send)
 * - Peers are discovered implicitly when they send messages
 * - No connection handshake - just open the channel
 */

import { createLogger } from "@arnott/logger";
import type { ITransport } from "../interfaces/transport";
import type { TransportState, TransportConfig } from "../interfaces/types";

const log = createLogger("sync:broadcast");

/** Generate unique tab ID */
function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Message format sent over BroadcastChannel */
interface BroadcastMessage {
  sourceTabId: string;
  payload: Uint8Array; // Use Uint8Array for reliable structured clone
  timestamp: number;
}

/**
 * BroadcastTransport - local tab communication via BroadcastChannel.
 *
 * Note: BroadcastChannel is always broadcast - there's no way to send
 * to a specific peer. The send(peerId, data) method still broadcasts,
 * but the coordinator can use peerId for logging/tracking.
 */
export class BroadcastTransport implements ITransport {
  readonly type = "broadcast" as const;

  private channel: BroadcastChannel | null = null;
  private readonly tabId = generateTabId();
  private _state: TransportState = "disconnected";
  private roomId: string | null = null;

  // --- Callbacks ---
  onReceive: ((peerId: string, data: ArrayBuffer) => void) | null = null;
  onPeerReachable: ((peerId: string, isLocal: boolean) => void) | null = null;
  onPeerUnreachable: ((peerId: string) => void) | null = null;
  onStateChange: ((state: TransportState) => void) | null = null;

  get state(): TransportState {
    return this._state;
  }

  get isSupported(): boolean {
    return typeof BroadcastChannel !== "undefined";
  }

  getLocalId(): string {
    return this.tabId;
  }

  async connect(config: TransportConfig): Promise<void> {
    if (!this.isSupported) {
      throw new Error("BroadcastChannel not supported");
    }

    const { roomId } = config;

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

    this.channel.onmessage = (event: MessageEvent) => {
      this.handleMessage(event);
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

  /**
   * Broadcast data to all peers.
   * This is the primary send method for BroadcastChannel.
   */
  broadcast(data: ArrayBuffer): void {
    this.sendInternal(data);
  }

  /**
   * Send data to a specific peer.
   * Note: BroadcastChannel can't target specific peers,
   * so this just broadcasts. Coordinator handles dedup.
   */
  send(peerId: string, data: ArrayBuffer): void {
    // BroadcastChannel is always broadcast - log the intended target
    log.debug("Send to peer (broadcast)", { peerId });
    this.sendInternal(data);
  }

  /**
   * Internal send implementation.
   */
  private sendInternal(data: ArrayBuffer): void {
    if (this._state !== "connected" || !this.channel) {
      log.debug("Send skipped - not connected", { state: this._state });
      return;
    }

    const message: BroadcastMessage = {
      sourceTabId: this.tabId,
      payload: new Uint8Array(data),
      timestamp: performance.now(),
    };

    log.debug("Sending", { tabId: this.tabId, payloadLength: message.payload.byteLength });
    this.channel.postMessage(message);
  }

  /**
   * Handle incoming message from BroadcastChannel.
   */
  private handleMessage(event: MessageEvent): void {
    const msg = event.data as BroadcastMessage;

    // Validate message format
    if (!msg || typeof msg.sourceTabId !== "string" || !msg.payload) {
      log.debug("Invalid message format", { msg });
      return;
    }

    // Skip messages from self
    if (msg.sourceTabId === this.tabId) {
      return;
    }

    log.debug("Received message", { from: msg.sourceTabId, payloadLength: msg.payload.byteLength });

    // Convert Uint8Array back to ArrayBuffer
    // Note: payload.buffer might be a SharedArrayBuffer, so we create a new ArrayBuffer
    const data = new Uint8Array(msg.payload).buffer;

    // Report peer reachable (all broadcast peers are local)
    this.onPeerReachable?.(msg.sourceTabId, true);

    // Report received data
    this.onReceive?.(msg.sourceTabId, data);
  }

  private setState(state: TransportState): void {
    if (this._state !== state) {
      this._state = state;
      this.onStateChange?.(state);
    }
  }
}
