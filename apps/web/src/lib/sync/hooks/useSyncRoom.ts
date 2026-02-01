/**
 * useSyncRoom - Main hook for real-time sync.
 *
 * Provides a unified interface for syncing state across:
 * - Local tabs (via BroadcastChannel)
 * - Remote peers (WebRTC P2P, low latency)
 * - Fallback relay (WebSocket, when P2P fails)
 *
 * Uses leader election - one tab owns WebSocket/WebRTC connections,
 * other tabs sync locally via BroadcastChannel.
 *
 * Time sync is automatic - no manual setTimeOffset calls needed.
 */

import { useRef, useCallback, useEffect, useState } from "react";
import { SyncCoordinator, type CoordinatorState } from "../sync-coordinator";

export interface UseSyncRoomOptions {
  /** Room ID to join */
  roomId: string;
  /** Auto-connect on mount (default: false) */
  autoConnect?: boolean;
  /** Message received callback (data, peerId, timeOffset) */
  onMessage?: (data: ArrayBuffer, peerId: string, timeOffset: number) => void;
  /** Peer connected callback */
  onPeerConnect?: (peerId: string) => void;
  /** Peer disconnected callback */
  onPeerDisconnect?: (peerId: string) => void;
  /** Connection state changed callback */
  onConnectionStateChange?: (state: CoordinatorState) => void;
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

  // Initialize coordinator
  const getCoordinator = useCallback((): SyncCoordinator => {
    if (!coordinatorRef.current) {
      coordinatorRef.current = new SyncCoordinator();

      // Set up callbacks
      coordinatorRef.current.onMessage = (data, peerId, timeOffset) => {
        optionsRef.current.onMessage?.(data, peerId, timeOffset);
      };

      coordinatorRef.current.onStateChange = (state) => {
        setConnectionState(state);
        setIsConnected(state === "connected");
        onConnectionStateChange?.(state);
      };

      coordinatorRef.current.onPeerJoin = (peerId) => {
        optionsRef.current.onPeerConnect?.(peerId);
      };

      coordinatorRef.current.onPeerLeave = (peerId) => {
        optionsRef.current.onPeerDisconnect?.(peerId);
      };
    }
    return coordinatorRef.current;
  }, [onConnectionStateChange]);

  // Connect
  const connect = useCallback(async () => {
    const coordinator = getCoordinator();
    await coordinator.connect(roomId);
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
