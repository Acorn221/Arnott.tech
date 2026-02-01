/**
 * useSyncRoom - Main hook for real-time sync.
 *
 * Provides a unified interface for syncing state across:
 * - Local tabs (via BroadcastChannel)
 * - Remote peers (WebRTC P2P, future)
 *
 * Time sync is automatic - no manual offset handling needed.
 * Peer tracking is internal - app just receives messages.
 */

import { useRef, useCallback, useEffect, useState } from "react";
import { createLogger } from "@arnott/logger";
import { SyncCoordinator, type CoordinatorState } from "../sync-coordinator";

// Test instrumentation types
interface SyncTestState {
  isConnected: boolean;
  peerCount: number;
  isLeader: boolean;
  localId: string;
}

interface SyncTestMessage {
  peerId: string;
  data: ArrayBuffer;
  timeOffset: number;
  timestamp: number;
}

// Extend Window for test instrumentation
declare global {
  interface Window {
    __sync_state__?: SyncTestState;
    __sync_messages__?: SyncTestMessage[];
    __sync_broadcast__?: (data: ArrayBuffer) => void;
    __sync_coordinator__?: SyncCoordinator;
  }
}

const log = createLogger("sync:hook");

export interface UseSyncRoomOptions {
  /** Room ID to join */
  roomId: string;
  /** Auto-connect on mount (default: false) */
  autoConnect?: boolean;
  /** Message received callback (data, peerId, timeOffset) */
  onMessage?: (data: ArrayBuffer, peerId: string, timeOffset: number) => void;
  /** Connection state changed callback */
  onConnectionStateChange?: (state: CoordinatorState) => void;
  /** New peer joined callback (for welcome effects, etc.) */
  onPeerJoin?: (peerId: string, isLocal: boolean) => void;
}

export interface UseSyncRoomReturn {
  /** Connect to the room */
  connect: () => Promise<void>;
  /** Disconnect from the room */
  disconnect: () => Promise<void>;
  /** Reconnect (disconnect then connect) */
  reconnect: () => Promise<void>;
  /** Broadcast data to all peers */
  broadcast: (data: ArrayBuffer) => void;
  /** Send data to a specific peer */
  sendTo: (peerId: string, data: ArrayBuffer) => void;
  /** Whether connected to the room */
  isConnected: boolean;
  /** Current connection state */
  connectionState: CoordinatorState;
  /** Whether this tab is the leader (owns remote connections) */
  isLeader: boolean;
}

export function useSyncRoom(options: UseSyncRoomOptions): UseSyncRoomReturn {
  const { roomId, autoConnect = false, onConnectionStateChange } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] =
    useState<CoordinatorState>("disconnected");

  // Refs
  const coordinatorRef = useRef<SyncCoordinator | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Update test instrumentation
  const updateTestState = useCallback((coordinator: SyncCoordinator) => {
    if (typeof window !== "undefined") {
      window.__sync_state__ = {
        isConnected: coordinator.isConnected,
        peerCount: coordinator.peerCount,
        isLeader: coordinator.isLeader,
        localId: coordinator.getLocalId(),
      };
    }
  }, []);

  // Initialize coordinator
  const getCoordinator = useCallback((): SyncCoordinator => {
    if (!coordinatorRef.current) {
      coordinatorRef.current = new SyncCoordinator();

      // Initialize test instrumentation
      if (typeof window !== "undefined") {
        window.__sync_messages__ = [];
        window.__sync_coordinator__ = coordinatorRef.current;
        window.__sync_broadcast__ = (data: ArrayBuffer) => {
          coordinatorRef.current?.broadcast(data);
        };
      }

      // Set up callbacks
      coordinatorRef.current.onMessage = (data, peerId, timeOffset) => {
        // Store for test inspection
        if (typeof window !== "undefined" && window.__sync_messages__) {
          window.__sync_messages__.push({
            peerId,
            data,
            timeOffset,
            timestamp: Date.now(),
          });
          // Keep only last 100 messages
          if (window.__sync_messages__.length > 100) {
            window.__sync_messages__.shift();
          }
        }
        optionsRef.current.onMessage?.(data, peerId, timeOffset);
      };

      coordinatorRef.current.onStateChange = (state) => {
        log.debug("State changed in hook", { state });
        setConnectionState(state);
        setIsConnected(state === "connected");
        updateTestState(coordinatorRef.current!);
        onConnectionStateChange?.(state);
      };

      coordinatorRef.current.onPeerJoin = (peerId, isLocal) => {
        log.debug("Peer joined", { peerId, isLocal });
        updateTestState(coordinatorRef.current!);
        optionsRef.current.onPeerJoin?.(peerId, isLocal);
      };
    }
    return coordinatorRef.current;
  }, [onConnectionStateChange, updateTestState]);

  // Connect
  const connect = useCallback(async () => {
    log.debug("Connecting", { roomId });
    const coordinator = getCoordinator();
    await coordinator.connect(roomId);
    log.debug("Connected", { roomId, state: coordinator.state });
  }, [getCoordinator, roomId]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (coordinatorRef.current) {
      await coordinatorRef.current.disconnect();
    }
  }, []);

  // Reconnect
  const reconnect = useCallback(async () => {
    await disconnect();
    await connect();
  }, [connect, disconnect]);

  // Broadcast
  const broadcast = useCallback((data: ArrayBuffer) => {
    coordinatorRef.current?.broadcast(data);
  }, []);

  // Send to specific peer
  const sendTo = useCallback((peerId: string, data: ArrayBuffer) => {
    coordinatorRef.current?.sendTo(peerId, data);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      void connect();
    }

    return () => {
      void disconnect();
      // Cleanup test instrumentation
      if (typeof window !== "undefined") {
        delete window.__sync_state__;
        delete window.__sync_messages__;
        delete window.__sync_broadcast__;
        delete window.__sync_coordinator__;
      }
    };
  }, [autoConnect, connect, disconnect]);

  // Network awareness - reconnect when back online
  useEffect(() => {
    const handleOnline = () => {
      if (connectionState === "disconnected" && coordinatorRef.current) {
        void connect();
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [connectionState, connect]);

  return {
    connect,
    disconnect,
    reconnect,
    broadcast,
    sendTo,
    isConnected,
    connectionState,
    isLeader: coordinatorRef.current?.isLeader ?? false,
  };
}
