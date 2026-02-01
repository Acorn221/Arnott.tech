/**
 * TimeSyncManager - Isolated time synchronization logic.
 *
 * Handles clock offset calculation between peers.
 * Each tab/browser has a different performance.now() origin,
 * so we need to calculate offsets to compare timestamps across peers.
 *
 * Key design rules:
 * 1. NO callbacks - coordinator calls methods synchronously
 * 2. Returns data that coordinator uses to update PeerRegistry
 * 3. Does NOT modify any external state
 */

import { createLogger } from "@arnott/logger";

const log = createLogger("sync:timesync");

/** Time-sync message format (JSON) */
export interface TimeSyncMessage {
  type: "time-sync";
  localTime: number;
}

/** Result of handling a time-sync message */
export interface TimeSyncResult {
  /** Calculated time offset (peer time - local time) */
  offset: number;
  /** Whether this was a new peer (no previous offset) */
  isNewPeer: boolean;
  /** Whether we should respond with our own time-sync */
  shouldRespond: boolean;
}

/**
 * TimeSyncManager - handles peer clock synchronization.
 *
 * Usage:
 * ```ts
 * const timeSync = new TimeSyncManager();
 *
 * // When peer discovered, create sync message to send
 * const syncMessage = timeSync.createSyncMessage();
 * transport.send(peerId, syncMessage);
 *
 * // When sync message received, handle it
 * const result = timeSync.handleMessage(peerId, data);
 * if (result) {
 *   registry.setTimeOffset(peerId, result.offset);
 *   if (result.shouldRespond) {
 *     transport.send(peerId, timeSync.createSyncMessage());
 *   }
 * }
 *
 * // Query offset
 * const offset = timeSync.getOffset(peerId);
 * ```
 */
export class TimeSyncManager {
  /** Stored offsets per peer */
  private offsets = new Map<string, number>();

  /**
   * Create a time-sync message to send to a peer.
   * @returns ArrayBuffer containing the sync message
   */
  createSyncMessage(): ArrayBuffer {
    const msg: TimeSyncMessage = {
      type: "time-sync",
      localTime: performance.now(),
    };
    const data = new TextEncoder().encode(JSON.stringify(msg));
    return data.buffer as ArrayBuffer;
  }

  /**
   * Check if data is a time-sync message.
   * @param data - Raw data received
   * @returns true if this is a time-sync message
   */
  isTimeSyncMessage(data: ArrayBuffer): boolean {
    if (data.byteLength > 100) return false;

    try {
      const text = new TextDecoder().decode(data);
      const msg = JSON.parse(text);
      return msg?.type === "time-sync" && typeof msg.localTime === "number";
    } catch {
      return false;
    }
  }

  /**
   * Handle a time-sync message from a peer.
   * @param peerId - Peer who sent the message
   * @param data - Raw message data
   * @returns TimeSyncResult with offset and flags, or null if invalid message
   */
  handleMessage(peerId: string, data: ArrayBuffer): TimeSyncResult | null {
    try {
      const text = new TextDecoder().decode(data);
      const msg = JSON.parse(text) as TimeSyncMessage;

      if (msg.type !== "time-sync" || typeof msg.localTime !== "number") {
        return null;
      }

      const oldOffset = this.offsets.get(peerId);
      const isNewPeer = oldOffset === undefined;
      const offset = performance.now() - msg.localTime;

      // Store the offset
      this.offsets.set(peerId, offset);

      log.debug("Time sync processed", { peerId, offset, isNewPeer });

      return {
        offset,
        isNewPeer,
        // Respond if this is a new peer (bidirectional sync)
        shouldRespond: isNewPeer,
      };
    } catch (err) {
      log.debug("Failed to parse time-sync message", { error: err });
      return null;
    }
  }

  /**
   * Get the time offset for a peer.
   * @param peerId - Peer ID
   * @returns Offset in ms, or 0 if not established
   */
  getOffset(peerId: string): number {
    return this.offsets.get(peerId) ?? 0;
  }

  /**
   * Check if peer has an established time offset.
   * @param peerId - Peer ID
   * @returns true if offset has been calculated
   */
  isReady(peerId: string): boolean {
    return this.offsets.has(peerId);
  }

  /**
   * Remove a peer's offset (when peer disconnects).
   * @param peerId - Peer ID
   */
  removePeer(peerId: string): void {
    this.offsets.delete(peerId);
  }

  /**
   * Clear all stored offsets.
   */
  clear(): void {
    this.offsets.clear();
  }
}
