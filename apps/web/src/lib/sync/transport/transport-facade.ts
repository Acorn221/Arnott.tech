/**
 * TransportFacade - Unified sync transport API.
 *
 * Uses FallbackCoordinator with leader election for WebRTC P2P support.
 */

import { createLogger } from "@arnott/logger";
import { FallbackCoordinator } from "./fallback-coordinator";
import type { TransportState, SyncMessage } from "./types";

const log = createLogger("sync:facade");

/** Simple LRU cache for message deduplication */
class MessageCache {
  private cache = new Map<string, number>();
  private readonly maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  set(key: string, timestamp: number): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, timestamp);
  }
}

/** Generate message ID for deduplication (first 16 bytes of ArrayBuffer) */
function getMessageId(data: unknown): string | null {
  if (data instanceof ArrayBuffer) {
    const view = new Uint8Array(data.slice(0, 16));
    return Array.from(view)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TransportFacadeOptions {
  // Reserved for future options
}

export class TransportFacade {
  private transport: FallbackCoordinator;
  private messageDedup = new MessageCache();

  // Callbacks
  onMessage: ((message: SyncMessage) => void) | null = null;
  onStateChange: ((state: TransportState) => void) | null = null;
  onPeerConnect: ((peerId: string) => void) | null = null;
  onPeerDisconnect: ((peerId: string) => void) | null = null;

  constructor(_options: TransportFacadeOptions = {}) {
    this.transport = new FallbackCoordinator();

    // Wire up callbacks with deduplication
    this.transport.onMessage = (msg) => this.handleMessage(msg);
    this.transport.onStateChange = (state) => {
      log.debug("State changed", { state });
      this.onStateChange?.(state);
    };
    this.transport.onPeerConnect = (peerId) => {
      log.debug("Peer connected", { peerId });
      this.onPeerConnect?.(peerId);
    };
    this.transport.onPeerDisconnect = (peerId) => {
      log.debug("Peer disconnected", { peerId });
      this.onPeerDisconnect?.(peerId);
    };
  }

  get state(): TransportState {
    return this.transport.state;
  }

  get isConnected(): boolean {
    return this.transport.state === "connected";
  }

  /** Whether this tab is the leader (owns remote connections) */
  get isLeader(): boolean {
    return this.transport.isLeader;
  }

  async connect(roomId: string): Promise<void> {
    log.info("Connecting", { roomId });
    return this.transport.connect(roomId);
  }

  async disconnect(): Promise<void> {
    log.debug("Disconnecting");
    return this.transport.disconnect();
  }

  broadcast(data: ArrayBuffer | string): void {
    this.transport.broadcast(data);
  }

  sendTo(peerId: string, data: ArrayBuffer | string): void {
    this.transport.sendTo(peerId, data);
  }

  setTimeOffset(peerId: string, offset: number): void {
    this.transport.setTimeOffset(peerId, offset);
  }

  private handleMessage(msg: SyncMessage): void {
    // Deduplication - same message may arrive via multiple paths
    const msgId = getMessageId(msg.data);
    if (msgId) {
      if (this.messageDedup.has(msgId)) {
        return;
      }
      this.messageDedup.set(msgId, msg.receivedAt);
    }

    this.onMessage?.(msg);
  }
}
