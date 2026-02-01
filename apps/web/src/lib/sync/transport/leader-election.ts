/**
 * Leader Election for tab-to-tab sync.
 *
 * Ensures only one tab per device connects to WebSocket/WebRTC.
 * Uses BroadcastChannel for election protocol.
 *
 * Priority: Lowest creation timestamp wins (oldest tab is leader).
 * Tiebreaker: Lexicographically lowest tab ID.
 */

import type { MessageSource } from "./types";

export type LeaderRole = "unknown" | "candidate" | "leader" | "follower";

/** Election protocol messages */
type LeaderMessage =
  | { type: "ANNOUNCE"; tabId: string; timestamp: number; roomId: string }
  | { type: "CLAIM"; tabId: string; timestamp: number; roomId: string }
  | { type: "HEARTBEAT"; tabId: string; roomId: string }
  | { type: "ABDICATE"; tabId: string; roomId: string }
  | { type: "RELAY_REQUEST"; fromTabId: string; roomId: string; data: string }
  | { type: "RELAY_BROADCAST"; roomId: string; source: MessageSource; data: string };

export interface LeaderElectionConfig {
  roomId: string;
  /** Heartbeat interval in ms (default: 2000) */
  heartbeatInterval?: number;
  /** Timeout before considering leader dead (default: 6000 = 3 missed beats) */
  heartbeatTimeout?: number;
  /** Time to wait for responses during election (default: 500) */
  electionTimeout?: number;
}

/** Generate unique tab ID */
function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class LeaderElection {
  readonly tabId: string;
  readonly tabTimestamp: number;
  readonly roomId: string;

  private _role: LeaderRole = "unknown";
  private currentLeader: { tabId: string; timestamp: number } | null = null;
  private channel: BroadcastChannel | null = null;

  private heartbeatInterval: number;
  private heartbeatTimeout: number;
  private electionTimeout: number;

  private heartbeatTimer: number | null = null;
  private leaderTimeoutTimer: number | null = null;
  private electionTimer: number | null = null;

  private started = false;

  // Callbacks
  onBecomeLeader: (() => void) | null = null;
  onBecomeFollower: (() => void) | null = null;
  onLeaderLost: (() => void) | null = null;
  /** Called when a follower requests relay (leader only) */
  onRelayRequest: ((data: ArrayBuffer | string) => void) | null = null;
  /** Called when leader relays a remote message (followers only) */
  onRelayBroadcast: ((source: MessageSource, data: ArrayBuffer | string) => void) | null = null;

  constructor(config: LeaderElectionConfig) {
    this.roomId = config.roomId;
    this.tabId = generateTabId();
    this.tabTimestamp = Date.now();
    this.heartbeatInterval = config.heartbeatInterval ?? 2000;
    this.heartbeatTimeout = config.heartbeatTimeout ?? 6000;
    this.electionTimeout = config.electionTimeout ?? 500;
  }

  get role(): LeaderRole {
    return this._role;
  }

  get isLeader(): boolean {
    return this._role === "leader";
  }

  get isFollower(): boolean {
    return this._role === "follower";
  }

  get isSupported(): boolean {
    return typeof BroadcastChannel !== "undefined";
  }

  /**
   * Start leader election.
   * Returns a promise that resolves when election is complete.
   */
  async start(): Promise<void> {
    if (this.started || !this.isSupported) {
      return;
    }

    this.started = true;
    this.channel = new BroadcastChannel(`leader-${this.roomId}`);
    this.channel.onmessage = (event: MessageEvent<LeaderMessage>) => {
      this.handleMessage(event.data);
    };

    // Register beforeunload to abdicate gracefully
    window.addEventListener("beforeunload", this.handleBeforeUnload);

    // Start election
    return this.runElection();
  }

  /**
   * Stop leader election and clean up.
   */
  stop(): void {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.clearTimers();

    window.removeEventListener("beforeunload", this.handleBeforeUnload);

    if (this._role === "leader") {
      this.sendMessage({ type: "ABDICATE", tabId: this.tabId, roomId: this.roomId });
    }

    this.channel?.close();
    this.channel = null;
    this._role = "unknown";
    this.currentLeader = null;
  }

  /**
   * Request leader to relay data to remote peers (follower only).
   */
  requestRelay(data: ArrayBuffer | string): void {
    if (this._role !== "follower" || !this.channel) {
      return;
    }

    // Convert ArrayBuffer to base64 for BroadcastChannel
    const dataStr = data instanceof ArrayBuffer
      ? `__binary__${arrayBufferToBase64(data)}`
      : data;

    this.sendMessage({
      type: "RELAY_REQUEST",
      fromTabId: this.tabId,
      roomId: this.roomId,
      data: dataStr,
    });
  }

  /**
   * Relay remote message to followers (leader only).
   */
  relayToFollowers(source: MessageSource, data: ArrayBuffer | string): void {
    if (this._role !== "leader" || !this.channel) {
      return;
    }

    const dataStr = data instanceof ArrayBuffer
      ? `__binary__${arrayBufferToBase64(data)}`
      : data;

    this.sendMessage({
      type: "RELAY_BROADCAST",
      roomId: this.roomId,
      source,
      data: dataStr,
    });
  }

  private handleBeforeUnload = (): void => {
    if (this._role === "leader") {
      this.sendMessage({ type: "ABDICATE", tabId: this.tabId, roomId: this.roomId });
    }
  };

  private async runElection(): Promise<void> {
    return new Promise((resolve) => {
      this._role = "candidate";

      // Announce our existence
      this.sendMessage({
        type: "ANNOUNCE",
        tabId: this.tabId,
        timestamp: this.tabTimestamp,
        roomId: this.roomId,
      });

      // Wait for responses
      this.electionTimer = window.setTimeout(() => {
        this.electionTimer = null;

        if (this._role !== "candidate") {
          // Already became follower
          resolve();
          return;
        }

        // No higher priority tabs responded - claim leadership
        this.claimLeadership();
        resolve();
      }, this.electionTimeout);
    });
  }

  private claimLeadership(): void {
    this._role = "leader";
    this.currentLeader = { tabId: this.tabId, timestamp: this.tabTimestamp };

    // Announce claim
    this.sendMessage({
      type: "CLAIM",
      tabId: this.tabId,
      timestamp: this.tabTimestamp,
      roomId: this.roomId,
    });

    // Start heartbeat
    this.startHeartbeat();

    this.onBecomeLeader?.();
  }

  private becomeFollower(leader: { tabId: string; timestamp: number }): void {
    const wasLeader = this._role === "leader";
    this._role = "follower";
    this.currentLeader = leader;

    // Stop heartbeat if we were leader
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Start watching for leader timeout
    this.resetLeaderTimeout();

    if (!wasLeader) {
      this.onBecomeFollower?.();
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // Send immediate heartbeat
    this.sendMessage({ type: "HEARTBEAT", tabId: this.tabId, roomId: this.roomId });

    // Schedule periodic heartbeats
    this.heartbeatTimer = window.setInterval(() => {
      this.sendMessage({ type: "HEARTBEAT", tabId: this.tabId, roomId: this.roomId });
    }, this.heartbeatInterval);
  }

  private resetLeaderTimeout(): void {
    if (this.leaderTimeoutTimer) {
      clearTimeout(this.leaderTimeoutTimer);
    }

    this.leaderTimeoutTimer = window.setTimeout(() => {
      this.leaderTimeoutTimer = null;
      this.handleLeaderLost();
    }, this.heartbeatTimeout);
  }

  private handleLeaderLost(): void {
    this.currentLeader = null;
    this.onLeaderLost?.();

    // Start new election
    void this.runElection();
  }

  private handleMessage(msg: LeaderMessage): void {
    // Ignore messages for other rooms
    if (msg.roomId !== this.roomId) {
      return;
    }

    switch (msg.type) {
      case "ANNOUNCE":
        this.handleAnnounce(msg);
        break;
      case "CLAIM":
        this.handleClaim(msg);
        break;
      case "HEARTBEAT":
        this.handleHeartbeat(msg);
        break;
      case "ABDICATE":
        this.handleAbdicate(msg);
        break;
      case "RELAY_REQUEST":
        this.handleRelayRequest(msg);
        break;
      case "RELAY_BROADCAST":
        this.handleRelayBroadcast(msg);
        break;
    }
  }

  private handleAnnounce(msg: { tabId: string; timestamp: number }): void {
    // If we're leader, send heartbeat so new tab knows
    if (this._role === "leader") {
      this.sendMessage({ type: "HEARTBEAT", tabId: this.tabId, roomId: this.roomId });
      return;
    }

    // If we're candidate and they have higher priority, yield
    const self = { tabId: this.tabId, timestamp: this.tabTimestamp };
    if (this._role === "candidate" && this.hasHigherPriority(msg, self)) {
      this.becomeFollower(msg);
    }
  }

  private handleClaim(msg: { tabId: string; timestamp: number }): void {
    // Accept their leadership if they have higher priority
    const self = { tabId: this.tabId, timestamp: this.tabTimestamp };
    if (this.hasHigherPriority(msg, self) || this._role !== "leader") {
      this.becomeFollower(msg);
    }
  }

  private handleHeartbeat(msg: { tabId: string }): void {
    if (this._role === "follower" && this.currentLeader?.tabId === msg.tabId) {
      this.resetLeaderTimeout();
    } else if (this._role === "candidate" || this._role === "unknown") {
      // Leader exists, become follower
      // We don't know their timestamp, use current time as placeholder
      this.becomeFollower({ tabId: msg.tabId, timestamp: 0 });
    }
  }

  private handleAbdicate(msg: { tabId: string }): void {
    if (this.currentLeader?.tabId === msg.tabId) {
      this.currentLeader = null;
      this.onLeaderLost?.();
      void this.runElection();
    }
  }

  private handleRelayRequest(msg: { fromTabId: string; data: string }): void {
    if (this._role !== "leader") {
      return;
    }

    // Decode data
    const data = msg.data.startsWith("__binary__")
      ? base64ToArrayBuffer(msg.data.slice(10))
      : msg.data;

    this.onRelayRequest?.(data);
  }

  private handleRelayBroadcast(msg: { source: MessageSource; data: string }): void {
    if (this._role !== "follower") {
      return;
    }

    // Decode data
    const data = msg.data.startsWith("__binary__")
      ? base64ToArrayBuffer(msg.data.slice(10))
      : msg.data;

    this.onRelayBroadcast?.(msg.source, data);
  }

  /**
   * Compare priority: lower timestamp wins, then lower tabId.
   */
  private hasHigherPriority(
    a: { tabId: string; timestamp: number },
    b: { tabId: string; timestamp: number }
  ): boolean {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp < b.timestamp;
    }
    return a.tabId < b.tabId;
  }

  private sendMessage(msg: LeaderMessage): void {
    this.channel?.postMessage(msg);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.leaderTimeoutTimer) {
      clearTimeout(this.leaderTimeoutTimer);
      this.leaderTimeoutTimer = null;
    }
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      this.electionTimer = null;
    }
  }
}

// Helper functions for binary data over BroadcastChannel
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
