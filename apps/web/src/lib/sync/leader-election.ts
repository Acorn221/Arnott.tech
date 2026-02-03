/**
 * LeaderElection - Isolated leader election via BroadcastChannel.
 *
 * Only one tab in a browser should connect to the signaling server.
 * Other tabs relay through BroadcastChannel via the leader.
 *
 * Election rules:
 * - Oldest tab (lowest timestamp) wins
 * - Tie-breaker: lowest tabId
 * - Leader sends heartbeats every 500ms
 * - Follower promotes to leader if no heartbeat for 2s
 */

import { createLogger } from "@arnott/logger";

import {
  LEADER_HEARTBEAT_INTERVAL_MS,
  LEADER_INITIAL_CHECK_DELAY_MS,
  LEADER_TIMEOUT_MS,
} from "./config";

const log = createLogger("sync:leader");

/** Leader election message types */
interface ElectionMessage {
  type: "heartbeat" | "claim";
  tabId: string;
  timestamp: number;
}

export interface LeaderElectionOptions {
  /** Room ID for scoping the election */
  roomId: string;
  /** Optional tab ID (generated if not provided) */
  tabId?: string;
  /** Heartbeat interval in ms */
  heartbeatInterval?: number;
  /** Leader timeout in ms */
  leaderTimeout?: number;
}

/**
 * Isolated leader election.
 *
 * Usage:
 * ```ts
 * const election = new LeaderElection({ roomId: "spinner" });
 * election.onBecomeLeader = () => connectSignaling();
 * election.onBecomeFollower = () => disconnectSignaling();
 * await election.start();
 * ```
 */
export class LeaderElection {
  private channel: BroadcastChannel | null = null;
  private readonly tabId: string;
  private readonly tabTimestamp: number;
  private readonly roomId: string;
  private readonly heartbeatInterval: number;
  private readonly leaderTimeoutMs: number;

  private _isLeader = false;
  private _leaderId: string | null = null;
  private heartbeatTimer: number | null = null;
  private watchdogTimer: number | null = null;
  private started = false;

  // --- Callbacks ---
  onBecomeLeader: (() => void) | null = null;
  onBecomeFollower: ((leaderId: string) => void) | null = null;
  onLeaderLost: (() => void) | null = null;

  constructor(options: LeaderElectionOptions) {
    this.roomId = options.roomId;
    this.tabId = options.tabId ?? `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.tabTimestamp = Date.now();
    this.heartbeatInterval = options.heartbeatInterval ?? LEADER_HEARTBEAT_INTERVAL_MS;
    this.leaderTimeoutMs = options.leaderTimeout ?? LEADER_TIMEOUT_MS;
  }

  /** Whether this tab is the leader */
  get isLeader(): boolean {
    return this._isLeader;
  }

  /** Current leader's tab ID (null if unknown) */
  get leaderId(): string | null {
    return this._leaderId;
  }

  /** This tab's ID */
  get myTabId(): string {
    return this.tabId;
  }

  /**
   * Start the leader election.
   * Waits briefly for an existing leader before claiming.
   */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // Open election channel
    this.channel = new BroadcastChannel(`leader-${this.roomId}`);
    this.channel.onmessage = (e: MessageEvent<ElectionMessage>) => {
      this.handleMessage(e.data);
    };

    // Check for existing leader
    const hasLeader = await this.checkForLeader();

    if (hasLeader) {
      this._isLeader = false;
      this.startWatchdog();
      log.debug("Became follower", { leaderId: this._leaderId });
      if (this._leaderId !== null) {
        this.onBecomeFollower?.(this._leaderId);
      }
    } else {
      await this.claimLeadership();
    }

    // Handle page close
    window.addEventListener("beforeunload", this.handleBeforeUnload);
  }

  /**
   * Stop the leader election.
   */
  stop(): void {
    if (!this.started) return;
    this.started = false;

    // Stop timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }

    // Close channel
    this.channel?.close();
    this.channel = null;

    // Cleanup
    this._isLeader = false;
    this._leaderId = null;
    window.removeEventListener("beforeunload", this.handleBeforeUnload);
  }

  /**
   * Check if there's an existing leader (wait for heartbeat).
   */
  private async checkForLeader(): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false;

      // Wait briefly for existing leader heartbeat
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(false); // No leader found
        }
      }, LEADER_INITIAL_CHECK_DELAY_MS);

      const originalHandler = this.channel!.onmessage;
      this.channel!.onmessage = (e: MessageEvent<ElectionMessage>) => {
        const msg = e.data;
        if (msg.type === "heartbeat" || msg.type === "claim") {
          this._leaderId = msg.tabId;
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(true); // Leader exists
          }
        }

        // Restore and call original handler
        if (originalHandler && this.channel) {
          this.channel.onmessage = originalHandler;
          originalHandler.call(this.channel, e);
        }
      };
    });
  }

  /**
   * Claim leadership.
   */
  private async claimLeadership(): Promise<void> {
    this._isLeader = true;
    this._leaderId = this.tabId;

    log.debug("Claimed leadership", { tabId: this.tabId });

    // Announce claim
    this.sendMessage({ type: "claim", tabId: this.tabId, timestamp: this.tabTimestamp });

    // Start heartbeat
    this.startHeartbeat();

    this.onBecomeLeader?.();
  }

  /**
   * Yield leadership to another tab.
   */
  private yieldTo(newLeaderId: string): void {
    if (!this._isLeader) return;

    log.debug("Yielding leadership", { newLeader: newLeaderId });

    this._isLeader = false;
    this._leaderId = newLeaderId;

    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Start watching for new leader
    this.startWatchdog();

    this.onBecomeFollower?.(newLeaderId);
  }

  /**
   * Start sending heartbeats.
   */
  private startHeartbeat(): void {
    // Send immediate heartbeat
    this.sendMessage({ type: "heartbeat", tabId: this.tabId, timestamp: this.tabTimestamp });

    // Send periodically
    this.heartbeatTimer = window.setInterval(() => {
      this.sendMessage({ type: "heartbeat", tabId: this.tabId, timestamp: this.tabTimestamp });
    }, this.heartbeatInterval);
  }

  /**
   * Start watching for leader timeout.
   */
  private startWatchdog(): void {
    this.resetWatchdog();
  }

  /**
   * Reset the leader timeout watchdog.
   */
  private resetWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
    }

    this.watchdogTimer = window.setTimeout(() => {
      log.debug("Leader timeout, attempting takeover");
      this.onLeaderLost?.();
      void this.claimLeadership();
    }, this.leaderTimeoutMs);
  }

  /**
   * Handle incoming election messages.
   */
  private handleMessage(msg: ElectionMessage): void {
    if (msg.type === "heartbeat") {
      if (!this._isLeader) {
        this._leaderId = msg.tabId;
        this.resetWatchdog();
      }
    } else if (msg.type === "claim") {
      if (this._isLeader && this.shouldYieldTo(msg.tabId, msg.timestamp)) {
        this.yieldTo(msg.tabId);
      } else if (!this._isLeader) {
        this._leaderId = msg.tabId;
        this.resetWatchdog();
      }
    }
  }

  /**
   * Determine if we should yield to another tab.
   */
  private shouldYieldTo(otherTabId: string, otherTimestamp: number): boolean {
    // Lower timestamp wins (older tab)
    if (otherTimestamp !== this.tabTimestamp) {
      return otherTimestamp < this.tabTimestamp;
    }
    // Tie-breaker: lower tabId
    return otherTabId < this.tabId;
  }

  /**
   * Handle page unload - stop heartbeat.
   */
  private handleBeforeUnload = (): void => {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  };

  /**
   * Send a message to other tabs.
   */
  private sendMessage(msg: ElectionMessage): void {
    this.channel?.postMessage(msg);
  }
}
