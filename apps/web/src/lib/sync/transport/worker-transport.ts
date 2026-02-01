/**
 * WorkerTransport - Tab-side transport that communicates with the SharedWorker.
 *
 * This provides the same Transport interface but delegates all actual
 * networking to the SharedWorker.
 */

import { createLogger } from "@arnott/logger";
import type { Transport, TransportState, SyncMessage, TransportType } from "./types";
import type { TabToWorkerMessage, WorkerToTabMessage } from "./worker-types";

const log = createLogger("sync:worker-client");

export class WorkerTransport implements Transport {
  readonly name: TransportType = "webrtc"; // Reports as webrtc since that's what the worker uses

  private worker: SharedWorker | null = null;
  private port: MessagePort | null = null;
  private _state: TransportState = "disconnected";
  private roomId: string | null = null;
  private workerReady = false;
  private pendingResolve: (() => void) | null = null;
  private pendingReject: ((err: Error) => void) | null = null;

  // Callbacks
  onMessage: ((message: SyncMessage) => void) | null = null;
  onStateChange: ((state: TransportState) => void) | null = null;
  onPeerConnect: ((peerId: string) => void) | null = null;
  onPeerDisconnect: ((peerId: string) => void) | null = null;

  get state(): TransportState {
    return this._state;
  }

  get isSupported(): boolean {
    return typeof SharedWorker !== "undefined";
  }

  async connect(roomId: string): Promise<void> {
    if (!this.isSupported) {
      throw new Error("SharedWorker not supported");
    }

    if (this._state === "connected" && this.roomId === roomId) {
      return;
    }

    this.roomId = roomId;
    this.setState("connecting");

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        log.error("Connection timeout waiting for worker");
        this.pendingResolve = null;
        this.pendingReject = null;
        this.setState("disconnected");
        reject(new Error("Connection timeout"));
      }, 10000); // 10 second timeout

      this.pendingResolve = () => {
        clearTimeout(timeout);
        this.pendingResolve = null;
        this.pendingReject = null;
        resolve();
      };

      this.pendingReject = (err: Error) => {
        clearTimeout(timeout);
        this.pendingResolve = null;
        this.pendingReject = null;
        reject(err);
      };

      try {
        // Create SharedWorker (single shared worker for all rooms)
        this.worker = new SharedWorker(
          new URL("../workers/sync-worker.ts", import.meta.url),
          { type: "module", name: "sync-worker" }
        );

        this.port = this.worker.port;

        // Handle worker errors
        this.worker.onerror = (err) => {
          log.error("SharedWorker error", { error: err });
          this.setState("disconnected");
          this.pendingReject?.(new Error("SharedWorker error"));
        };

        // Handle messages from worker
        this.port.onmessage = (event: MessageEvent<WorkerToTabMessage>) => {
          this.handleWorkerMessage(event.data);
        };

        this.port.onmessageerror = () => {
          log.error("Failed to deserialize worker message");
        };

        // Start the port
        this.port.start();
        log.info("Port started, waiting for worker ready", { roomId });
      } catch (err) {
        log.error("Failed to connect to SharedWorker", { error: err });
        this.setState("disconnected");
        clearTimeout(timeout);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  async disconnect(): Promise<void> {
    // Cancel any pending connection
    this.pendingReject?.(new Error("Disconnected"));
    this.pendingResolve = null;
    this.pendingReject = null;

    if (this.port) {
      this.sendToWorker({ type: "leave" });
      this.port.close();
      this.port = null;
    }

    this.worker = null;
    this.roomId = null;
    this.workerReady = false;
    this.setState("disconnected");

    log.info("Disconnected from SharedWorker");
  }

  broadcast(data: ArrayBuffer | string): void {
    if (!this.port) {
      log.warn("Cannot broadcast - not connected");
      return;
    }

    log.debug("Broadcasting", { type: data instanceof ArrayBuffer ? "binary" : "string", size: data instanceof ArrayBuffer ? data.byteLength : data.length });

    if (data instanceof ArrayBuffer) {
      // Transfer the buffer to the worker
      const clone = data.slice(0);
      const msg: TabToWorkerMessage = { type: "broadcast", data: clone };
      this.port.postMessage(msg, [clone]);
    } else {
      this.sendToWorker({ type: "broadcast", data });
    }
  }

  sendTo(peerId: string, data: ArrayBuffer | string): void {
    if (!this.port) {
      log.warn("Cannot sendTo - not connected");
      return;
    }

    if (data instanceof ArrayBuffer) {
      const clone = data.slice(0);
      const msg: TabToWorkerMessage = { type: "sendTo", peerId, data: clone };
      this.port.postMessage(msg, [clone]);
    } else {
      this.sendToWorker({ type: "sendTo", peerId, data });
    }
  }

  setTimeOffset(peerId: string, offset: number): void {
    this.sendToWorker({ type: "setTimeOffset", peerId, offset });
  }

  getDebugState(): void {
    this.sendToWorker({ type: "getState" });
  }

  private handleWorkerMessage(msg: WorkerToTabMessage): void {
    log.debug("Received from worker", { type: msg.type });

    switch (msg.type) {
      case "ready":
        log.info("Worker ready, sending join");
        this.workerReady = true;
        // Now that worker is ready, send the join
        if (this.roomId) {
          this.sendToWorker({ type: "join", roomId: this.roomId });
        }
        break;

      case "joined":
        log.info("Joined room confirmed", { roomId: msg.roomId });
        this.setState("connected");
        this.pendingResolve?.();
        break;

      case "message":
        log.debug("Message from worker", { source: msg.message.source });
        this.onMessage?.(msg.message);
        break;

      case "stateChange":
        this.setState(msg.state);
        break;

      case "peerConnect":
        this.onPeerConnect?.(msg.peerId);
        break;

      case "peerDisconnect":
        this.onPeerDisconnect?.(msg.peerId);
        break;

      case "state":
        log.debug("Worker state", msg.state);
        break;

      case "error":
        log.error("Worker error", { error: msg.error });
        this.pendingReject?.(new Error(msg.error));
        break;
    }
  }

  private sendToWorker(msg: TabToWorkerMessage): void {
    this.port?.postMessage(msg);
  }

  private setState(state: TransportState): void {
    if (this._state !== state) {
      this._state = state;
      this.onStateChange?.(state);
    }
  }
}
