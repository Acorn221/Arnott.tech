/**
 * TimeSyncManager - Isolated time synchronization logic.
 *
 * Handles clock offset calculation between peers using RTT-based sync.
 * Each tab/browser has a different performance.now() origin,
 * so we need to calculate offsets to compare timestamps across peers.
 *
 * Uses round-trip time (RTT) to eliminate network latency from the offset:
 * 1. A sends sync request with T_a1
 * 2. B responds with T_b1 (their receive time) and echoes T_a1
 * 3. A receives at T_a2, calculates:
 *    - RTT = T_a2 - T_a1
 *    - offset = T_b1 - (T_a1 + RTT/2) = T_b1 - T_a1 - RTT/2
 *
 * Key design rules:
 * 1. NO callbacks - coordinator calls methods synchronously
 * 2. Returns data that coordinator uses to update PeerRegistry
 * 3. Does NOT modify any external state
 */

import { createLogger } from "@arnott/logger";
import {
  TIME_SYNC_MAX_MESSAGE_SIZE,
  TIME_SYNC_LATENCY_BUFFER_MS,
} from "./config";

const log = createLogger("sync:timesync");

/** Encode a time sync message to ArrayBuffer */
function encodeTimeSyncMessage(msg: TimeSyncMessage): ArrayBuffer {
  return new TextEncoder().encode(JSON.stringify(msg)).buffer;
}

/** Time-sync request message (initiator) */
export interface TimeSyncRequest {
  type: "time-sync-request";
  requestTime: number; // T_a1 - when request was sent
}

/** Time-sync response message (responder) */
export interface TimeSyncResponse {
  type: "time-sync-response";
  requestTime: number; // T_a1 - echoed from request
  responseTime: number; // T_b1 - when response was sent
}

/** Combined message type for parsing */
export type TimeSyncMessage = TimeSyncRequest | TimeSyncResponse;

/** Result of handling a time-sync message */
export interface TimeSyncResult {
  /** Calculated time offset (add to peer timestamp to get local time) */
  offset: number;
  /** Whether this was a new peer (no previous offset) */
  isNewPeer: boolean;
  /** Response message to send back, if any */
  responseMessage: ArrayBuffer | null;
}

/**
 * TimeSyncManager - handles peer clock synchronization with RTT compensation.
 *
 * Usage:
 * ```ts
 * const timeSync = new TimeSyncManager();
 *
 * // When peer discovered, create sync request to send
 * const syncRequest = timeSync.createSyncRequest();
 * transport.send(peerId, syncRequest);
 *
 * // When sync message received, handle it
 * const result = timeSync.handleMessage(peerId, data);
 * if (result) {
 *   registry.setTimeOffset(peerId, result.offset);
 *   if (result.responseMessage) {
 *     transport.send(peerId, result.responseMessage);
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

  /** Pending sync requests (peerId -> requestTime) */
  private pendingRequests = new Map<string, number>();

  /**
   * Create a time-sync request message to send to a peer.
   * @param peerId - Peer to sync with (stored for RTT calculation)
   * @returns ArrayBuffer containing the sync request
   */
  createSyncRequest(peerId?: string): ArrayBuffer {
    const requestTime = performance.now();

    // Store the request time for RTT calculation when response arrives
    if (peerId) {
      this.pendingRequests.set(peerId, requestTime);
    }

    const msg: TimeSyncRequest = {
      type: "time-sync-request",
      requestTime,
    };
    return encodeTimeSyncMessage(msg);
  }

  /**
   * Check if data is a time-sync message.
   * @param data - Raw data received
   * @returns true if this is a time-sync message
   */
  isTimeSyncMessage(data: ArrayBuffer): boolean {
    if (data.byteLength > TIME_SYNC_MAX_MESSAGE_SIZE) return false;

    try {
      const text = new TextDecoder().decode(data);
      const msg = JSON.parse(text);
      return (
        (msg?.type === "time-sync-request" &&
          typeof msg.requestTime === "number") ||
        (msg?.type === "time-sync-response" &&
          typeof msg.requestTime === "number" &&
          typeof msg.responseTime === "number")
      );
    } catch {
      return false;
    }
  }

  /**
   * Handle a time-sync message from a peer.
   * @param peerId - Peer who sent the message
   * @param data - Raw message data
   * @returns TimeSyncResult with offset and response, or null if invalid message
   */
  handleMessage(peerId: string, data: ArrayBuffer): TimeSyncResult | null {
    try {
      const text = new TextDecoder().decode(data);
      const msg = JSON.parse(text);

      // Handle sync request - respond with our time
      if (
        msg.type === "time-sync-request" &&
        typeof msg.requestTime === "number"
      ) {
        const responseTime = performance.now();

        // Create response with both times
        const response: TimeSyncResponse = {
          type: "time-sync-response",
          requestTime: msg.requestTime,
          responseTime,
        };
        const responseData = encodeTimeSyncMessage(response);

        // Also send our own request to get bidirectional sync
        const isNewPeer = !this.offsets.has(peerId);

        // If we don't have a pending request to this peer, initiate one
        const shouldInitiateSync =
          isNewPeer && !this.pendingRequests.has(peerId);
        if (shouldInitiateSync) {
          this.pendingRequests.set(peerId, performance.now());
        }

        log.debug("Received sync request, sending response", {
          peerId,
          requestTime: msg.requestTime,
          responseTime,
        });

        // If this is a new peer and we should initiate, combine response + request
        if (shouldInitiateSync) {
          // Send response first, then request
          return {
            offset: this.offsets.get(peerId) ?? 0,
            isNewPeer,
            responseMessage: responseData,
          };
        }

        return {
          offset: this.offsets.get(peerId) ?? 0,
          isNewPeer: false,
          responseMessage: responseData,
        };
      }

      // Handle sync response - calculate RTT-compensated offset
      if (
        msg.type === "time-sync-response" &&
        typeof msg.requestTime === "number" &&
        typeof msg.responseTime === "number"
      ) {
        const receiveTime = performance.now(); // T_a2
        const requestTime = msg.requestTime; // T_a1 (echoed)
        const responseTime = msg.responseTime; // T_b1

        // Calculate RTT-compensated offset
        const rtt = receiveTime - requestTime;
        const oneWayLatency = rtt / 2;

        // Add a small buffer to ensure adjusted timestamps are slightly in the past
        // This handles asymmetric latency and ensures physics simulation always runs
        const offset =
          receiveTime -
          responseTime -
          oneWayLatency +
          TIME_SYNC_LATENCY_BUFFER_MS;

        const oldOffset = this.offsets.get(peerId);
        const isNewPeer = oldOffset === undefined;

        // Store the offset
        this.offsets.set(peerId, offset);

        // Clean up pending request
        this.pendingRequests.delete(peerId);

        log.debug("Time sync completed (RTT-based)", {
          peerId,
          offset,
          rtt,
          oneWayLatency,
          isNewPeer,
        });

        return {
          offset,
          isNewPeer,
          responseMessage: null,
        };
      }

      return null;
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
    this.pendingRequests.delete(peerId);
  }

  /**
   * Clear all stored offsets.
   */
  clear(): void {
    this.offsets.clear();
  }
}
