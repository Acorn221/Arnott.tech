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
 */

import { useRef, useCallback, useEffect, useState } from "react";
import { TransportFacade } from "../transport/transport-facade";
import type { TransportState, SyncMessage } from "../transport/types";

export interface UseSyncRoomOptions {
  /** Room ID to join */
  roomId: string;
  /** Auto-connect on mount (default: false) */
  autoConnect?: boolean;
  /** Message received callback */
  onMessage?: (message: SyncMessage) => void;
  /** Peer connected callback */
  onPeerConnect?: (peerId: string) => void;
  /** Peer disconnected callback */
  onPeerDisconnect?: (peerId: string) => void;
  /** Connection state changed callback */
  onConnectionStateChange?: (state: TransportState) => void;
}

export interface UseSyncRoomReturn {
  /** Connect to the room */
  connect: () => Promise<void>;
  /** Disconnect from the room */
  disconnect: () => Promise<void>;
  /** Reconnect (disconnect then connect) */
  reconnect: () => Promise<void>;
  /** Broadcast data to all peers */
  broadcast: (data: ArrayBuffer | string) => void;
  /** Send data to a specific peer */
  sendTo: (peerId: string, data: ArrayBuffer | string) => void;
  /** Whether connected to the room */
  isConnected: boolean;
  /** Current connection state */
  connectionState: TransportState;
  /** Whether this tab is the leader (owns remote connections) */
  isLeader: boolean;
  /** Set time offset for a specific peer */
  setTimeOffset: (peerId: string, offset: number) => void;
}

export function useSyncRoom(options: UseSyncRoomOptions): UseSyncRoomReturn {
  const { roomId, autoConnect = false, onConnectionStateChange } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] =
    useState<TransportState>("disconnected");

  // Refs
  const facadeRef = useRef<TransportFacade | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Initialize facade
  const getFacade = useCallback((): TransportFacade => {
    if (!facadeRef.current) {
      facadeRef.current = new TransportFacade();

      // Set up callbacks
      facadeRef.current.onMessage = (msg) => {
        optionsRef.current.onMessage?.(msg);
      };

      facadeRef.current.onStateChange = (state) => {
        setConnectionState(state);
        setIsConnected(state === "connected");
        onConnectionStateChange?.(state);
      };

      facadeRef.current.onPeerConnect = (peerId) => {
        optionsRef.current.onPeerConnect?.(peerId);
      };

      facadeRef.current.onPeerDisconnect = (peerId) => {
        optionsRef.current.onPeerDisconnect?.(peerId);
      };
    }
    return facadeRef.current;
  }, [onConnectionStateChange]);

  // Connect
  const connect = useCallback(async () => {
    const facade = getFacade();
    await facade.connect(roomId);
  }, [getFacade, roomId]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (facadeRef.current) {
      await facadeRef.current.disconnect();
    }
  }, []);

  // Reconnect
  const reconnect = useCallback(async () => {
    await disconnect();
    await connect();
  }, [connect, disconnect]);

  // Broadcast
  const broadcast = useCallback((data: ArrayBuffer | string) => {
    facadeRef.current?.broadcast(data);
  }, []);

  // Send to specific peer
  const sendTo = useCallback((peerId: string, data: ArrayBuffer | string) => {
    facadeRef.current?.sendTo(peerId, data);
  }, []);

  // Set time offset
  const setTimeOffset = useCallback((peerId: string, offset: number) => {
    facadeRef.current?.setTimeOffset(peerId, offset);
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
      if (connectionState === "disconnected" && facadeRef.current) {
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
    isLeader: facadeRef.current?.isLeader ?? false,
    setTimeOffset,
  };
}
