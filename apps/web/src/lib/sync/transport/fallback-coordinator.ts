/**
 * FallbackCoordinator - Simplified fallback for browsers without SharedWorker.
 *
 * Uses BroadcastChannel for local tab sync and a simple leader election
 * to decide which tab connects to signaling.
 *
 * Key simplification: Followers only get local tab sync, not remote messages.
 * This removes the complex relay mechanism.
 */

import { createLogger } from "@arnott/logger";
import { BroadcastTransport } from "./broadcast-transport";
import { SignalingTransport } from "./signaling-transport";
import type { Transport, TransportState, SyncMessage, TransportType } from "./types";

const log = createLogger("sync:fallback");

/** Simple heartbeat message for leader election */
interface HeartbeatMessage {
  type: "heartbeat" | "claim";
  tabId: string;
  timestamp: number;
}

export class FallbackCoordinator implements Transport {
  readonly name: TransportType = "broadcast";

  private broadcastTransport: BroadcastTransport;
  private signaling: SignalingTransport | null = null;
  private leaderChannel: BroadcastChannel | null = null;

  private tabId: string;
  private tabTimestamp: number;
  private _isLeader = false;
  private leaderTabId: string | null = null;
  private heartbeatTimer: number | null = null;
  private leaderTimeout: number | null = null;

  private _state: TransportState = "disconnected";
  private roomId: string | null = null;

  // Callbacks
  onMessage: ((message: SyncMessage) => void) | null = null;
  onStateChange: ((state: TransportState) => void) | null = null;
  onPeerConnect: ((peerId: string) => void) | null = null;
  onPeerDisconnect: ((peerId: string) => void) | null = null;

  constructor() {
    this.broadcastTransport = new BroadcastTransport();
    this.tabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.tabTimestamp = Date.now();
  }

  get state(): TransportState {
    return this._state;
  }

  get isSupported(): boolean {
    return this.broadcastTransport.isSupported;
  }

  get isLeader(): boolean {
    return this._isLeader;
  }

  async connect(roomId: string): Promise<void> {
    if (this._state === "connected" && this.roomId === roomId) {
      return;
    }

    this.roomId = roomId;
    this.setState("connecting");

    try {
      // 1. Connect BroadcastChannel for local sync
      this.broadcastTransport.onMessage = (msg) => this.onMessage?.(msg);
      await this.broadcastTransport.connect(roomId);

      // 2. Set up leader election channel
      this.leaderChannel = new BroadcastChannel(`leader-${roomId}`);
      this.leaderChannel.onmessage = (e: MessageEvent<HeartbeatMessage>) => {
        this.handleLeaderMessage(e.data);
      };

      // 3. Try to become leader
      const hasLeader = await this.checkForLeader();

      if (!hasLeader) {
        await this.becomeLeader();
      } else {
        this._isLeader = false;
        this.startLeaderWatchdog();
        log.info("Became follower (local sync only)", { leaderId: this.leaderTabId });
      }

      this.setState("connected");
    } catch (err) {
      log.error("Failed to connect", { error: err });
      this.setState("disconnected");
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    // Stop timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.leaderTimeout) {
      clearTimeout(this.leaderTimeout);
      this.leaderTimeout = null;
    }

    // Close channels
    this.leaderChannel?.close();
    this.leaderChannel = null;

    // Disconnect transports
    await this.broadcastTransport.disconnect();
    if (this.signaling) {
      await this.signaling.disconnect();
      this.signaling = null;
    }

    this._isLeader = false;
    this.leaderTabId = null;
    this.roomId = null;
    this.setState("disconnected");
  }

  broadcast(data: ArrayBuffer | string): void {
    // Always send to local tabs
    if (this.broadcastTransport.state === "connected") {
      this.broadcastTransport.broadcast(data);
    }

    // Only leader sends to remote
    if (this._isLeader && this.signaling?.state === "connected") {
      this.signaling.broadcast(data);
    }
  }

  sendTo(peerId: string, data: ArrayBuffer | string): void {
    // Only works for leader
    if (this._isLeader) {
      this.signaling?.sendTo(peerId, data);
    }
  }

  setTimeOffset(peerId: string, offset: number): void {
    // Only works for leader
    if (this._isLeader) {
      this.signaling?.setPeerTimeOffset(peerId, offset);
    }
  }

  /**
   * Check if there's already a leader (wait for heartbeat)
   */
  private async checkForLeader(): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(false); // No leader found
        }
      }, 500); // 500ms to hear a heartbeat

      const originalHandler = this.leaderChannel!.onmessage;
      this.leaderChannel!.onmessage = (e: MessageEvent<HeartbeatMessage>) => {
        if (e.data.type === "heartbeat" || e.data.type === "claim") {
          this.leaderTabId = e.data.tabId;
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(true); // Leader exists
          }
        }
        // Restore original handler
        if (originalHandler && this.leaderChannel) {
          this.leaderChannel.onmessage = originalHandler;
          originalHandler.call(this.leaderChannel, e);
        }
      };
    });
  }

  /**
   * Become the leader and connect signaling
   */
  private async becomeLeader(): Promise<void> {
    this._isLeader = true;
    this.leaderTabId = this.tabId;

    log.info("Became leader, connecting signaling");

    // Claim leadership
    this.sendLeaderMessage({ type: "claim", tabId: this.tabId, timestamp: this.tabTimestamp });

    // Start heartbeat
    this.startHeartbeat();

    // Connect signaling
    this.signaling = new SignalingTransport({
      enableWebRTC: true,
      autoReconnect: true,
    });

    this.signaling.onMessage = (msg) => this.onMessage?.(msg);
    this.signaling.onPeerConnect = (peerId) => this.onPeerConnect?.(peerId);
    this.signaling.onPeerDisconnect = (peerId) => this.onPeerDisconnect?.(peerId);

    this.signaling.onStateChange = (state) => {
      if (state === "disconnected" && this._state === "connected") {
        this.setState("reconnecting");
      }
    };

    await this.signaling.connect(this.roomId!);
  }

  /**
   * Start sending heartbeats (leader only)
   */
  private startHeartbeat(): void {
    // Send immediate heartbeat
    this.sendLeaderMessage({ type: "heartbeat", tabId: this.tabId, timestamp: this.tabTimestamp });

    // Send every 500ms
    this.heartbeatTimer = window.setInterval(() => {
      this.sendLeaderMessage({ type: "heartbeat", tabId: this.tabId, timestamp: this.tabTimestamp });
    }, 500);

    // Abdicate on page close
    window.addEventListener("beforeunload", this.handleBeforeUnload);
  }

  private handleBeforeUnload = (): void => {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
  };

  /**
   * Watch for leader timeout (follower only)
   */
  private startLeaderWatchdog(): void {
    this.resetLeaderTimeout();
  }

  private resetLeaderTimeout(): void {
    if (this.leaderTimeout) {
      clearTimeout(this.leaderTimeout);
    }

    // 2 seconds without heartbeat = leader lost
    this.leaderTimeout = window.setTimeout(() => {
      log.info("Leader timeout, attempting takeover");
      void this.becomeLeader();
    }, 2000);
  }

  /**
   * Handle leader election messages
   */
  private handleLeaderMessage(msg: HeartbeatMessage): void {
    if (msg.type === "heartbeat") {
      if (!this._isLeader) {
        this.leaderTabId = msg.tabId;
        this.resetLeaderTimeout();
      }
    } else if (msg.type === "claim") {
      // Someone claimed leadership
      if (this._isLeader && this.shouldYieldTo(msg.tabId, msg.timestamp)) {
        // They have priority, yield
        log.info("Yielding leadership", { newLeader: msg.tabId });
        void this.yieldLeadership();
        this.leaderTabId = msg.tabId;
        this.startLeaderWatchdog();
      } else if (!this._isLeader) {
        this.leaderTabId = msg.tabId;
        this.resetLeaderTimeout();
      }
    }
  }

  /**
   * Check if we should yield to another tab
   */
  private shouldYieldTo(otherTabId: string, otherTimestamp: number): boolean {
    // Lower timestamp wins (older tab)
    if (otherTimestamp !== this.tabTimestamp) {
      return otherTimestamp < this.tabTimestamp;
    }
    // Tiebreaker: lower tabId
    return otherTabId < this.tabId;
  }

  /**
   * Give up leadership
   */
  private async yieldLeadership(): Promise<void> {
    this._isLeader = false;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.signaling) {
      await this.signaling.disconnect();
      this.signaling = null;
    }

    window.removeEventListener("beforeunload", this.handleBeforeUnload);
  }

  private sendLeaderMessage(msg: HeartbeatMessage): void {
    this.leaderChannel?.postMessage(msg);
  }

  private setState(state: TransportState): void {
    if (this._state !== state) {
      this._state = state;
      this.onStateChange?.(state);
    }
  }
}
