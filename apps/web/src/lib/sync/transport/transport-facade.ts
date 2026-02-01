/**
 * TransportFacade - Unified sync transport API.
 *
 * Automatically selects the best transport strategy:
 * 1. SharedWorker (preferred) - Single connection, zero encoding overhead
 * 2. FallbackCoordinator - BroadcastChannel + simple leader election
 *
 * Provides consistent API regardless of underlying transport.
 */

import { createLogger } from "@arnott/logger";
import { WorkerTransport } from "./worker-transport";
import { FallbackCoordinator } from "./fallback-coordinator";
import type { TransportState, SyncMessage } from "./types";

/** Common interface for our transports */
interface SyncTransport {
  readonly state: TransportState;
  readonly isSupported: boolean;
  connect(roomId: string): Promise<void>;
  disconnect(): Promise<void>;
  broadcast(data: ArrayBuffer | string): void;
  onMessage: ((message: SyncMessage) => void) | null;
  onStateChange: ((state: TransportState) => void) | null;
  onPeerConnect: ((peerId: string) => void) | null;
  onPeerDisconnect: ((peerId: string) => void) | null;
}

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

export interface TransportFacadeOptions {
  /** Force a specific transport (for testing) */
  forceTransport?: "worker" | "fallback";
}

export class TransportFacade {
  private transport: SyncTransport;
  private workerTransport: WorkerTransport | null = null;
  private messageDedup = new MessageCache();
  private usingWorker: boolean;

  // Callbacks
  onMessage: ((message: SyncMessage) => void) | null = null;
  onStateChange: ((state: TransportState) => void) | null = null;
  onPeerConnect: ((peerId: string) => void) | null = null;
  onPeerDisconnect: ((peerId: string) => void) | null = null;

  constructor(options: TransportFacadeOptions = {}) {
    // Determine which transport to use
    const workerTransport = new WorkerTransport();
    const shouldUseWorker =
      options.forceTransport === "worker" ||
      (options.forceTransport !== "fallback" && workerTransport.isSupported);

    if (shouldUseWorker) {
      this.transport = workerTransport;
      this.workerTransport = workerTransport;
      this.usingWorker = true;
      log.info("Using SharedWorker transport");
    } else {
      this.transport = new FallbackCoordinator();
      this.usingWorker = false;
      log.info("Using fallback coordinator");
    }

    // Wire up callbacks with deduplication
    this.transport.onMessage = (msg) => this.handleMessage(msg);
    this.transport.onStateChange = (state) => {
      log.info("State changed", { state });
      this.onStateChange?.(state);
    };
    this.transport.onPeerConnect = (peerId) => {
      log.info("Peer connected", { peerId });
      this.onPeerConnect?.(peerId);
    };
    this.transport.onPeerDisconnect = (peerId) => {
      log.info("Peer disconnected", { peerId });
      this.onPeerDisconnect?.(peerId);
    };
  }

  get state(): TransportState {
    return this.transport.state;
  }

  get isConnected(): boolean {
    return this.transport.state === "connected";
  }

  get isUsingWorker(): boolean {
    return this.usingWorker;
  }

  async connect(roomId: string): Promise<void> {
    log.info("Connecting", { roomId, usingWorker: this.usingWorker });
    return this.transport.connect(roomId);
  }

  async disconnect(): Promise<void> {
    log.info("Disconnecting");
    return this.transport.disconnect();
  }

  broadcast(data: ArrayBuffer | string): void {
    log.debug("Facade broadcasting", { connected: this.isConnected });
    this.transport.broadcast(data);
  }

  sendTo(peerId: string, data: ArrayBuffer | string): void {
    if (this.workerTransport) {
      this.workerTransport.sendTo(peerId, data);
    }
  }

  setTimeOffset(peerId: string, offset: number): void {
    if (this.workerTransport) {
      this.workerTransport.setTimeOffset(peerId, offset);
    }
  }

  private handleMessage(msg: SyncMessage): void {
    log.debug("Facade received message", { source: msg.source.peerId, transport: msg.source.transport });

    // Deduplication - same message may arrive via multiple paths
    const msgId = getMessageId(msg.data);
    if (msgId) {
      if (this.messageDedup.has(msgId)) {
        log.debug("Duplicate message dropped", { msgId: msgId.slice(0, 8) });
        return;
      }
      this.messageDedup.set(msgId, msg.receivedAt);
    }

    log.debug("Passing message to onMessage callback", { hasCallback: !!this.onMessage });
    this.onMessage?.(msg);
  }
}
