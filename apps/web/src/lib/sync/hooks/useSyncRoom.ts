/**
 * useSyncRoom - Main hook for real-time sync.
 *
 * Provides a unified interface for syncing state across:
 * - Local tabs (BroadcastChannel, ~1ms)
 * - Remote peers (WebRTC P2P, low latency)
 * - Fallback relay (WebSocket, when P2P fails)
 *
 * With leader election enabled (default), only one tab per device
 * connects to remote peers. Other tabs sync through the leader.
 */

import { useRef, useCallback, useEffect, useState } from "react";
import {
  TransportManager,
  type TransportState,
  type SyncMessage,
  type LeaderRole,
} from "../transport";

export interface UseSyncRoomOptions {
  /** Room ID to join */
  roomId: string;
  /** Auto-connect on mount (default: false) */
  autoConnect?: boolean;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Enable BroadcastChannel for local tabs (default: true) */
  enableBroadcast?: boolean;
  /** Enable WebRTC for P2P connections (default: true) */
  enableWebRTC?: boolean;
  /** Enable WebSocket fallback (default: true) */
  enableWebSocket?: boolean;
  /** Enable leader election - only one tab connects to signaling (default: true) */
  enableLeaderElection?: boolean;
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
  /** Send data to a specific peer (leader only) */
  sendTo: (peerId: string, data: ArrayBuffer | string) => void;
  /** Whether connected to the room */
  isConnected: boolean;
  /** Current connection state */
  connectionState: TransportState;
  /** Number of connected peers (remote devices, not tabs) */
  peerCount: number;
  /** Our peer ID (null if not connected or follower) */
  myPeerId: string | null;
  /** Whether this tab is the leader (has signaling connection) */
  isLeader: boolean;
  /** Current leader election role */
  leaderRole: LeaderRole;
  /** Get time offset for a specific peer */
  getTimeOffset: (peerId: string) => number;
  /** Set time offset for a specific peer */
  setTimeOffset: (peerId: string, offset: number) => void;
}

export function useSyncRoom(options: UseSyncRoomOptions): UseSyncRoomReturn {
  const {
    roomId,
    autoConnect = false,
    autoReconnect = true,
    enableBroadcast = true,
    enableWebRTC = true,
    enableWebSocket = true,
    enableLeaderElection = true,
    onConnectionStateChange,
  } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<TransportState>("disconnected");
  const [peerCount, setPeerCount] = useState(0);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [leaderRole, setLeaderRole] = useState<LeaderRole>("unknown");

  // Refs
  const managerRef = useRef<TransportManager | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Initialize manager
  const getManager = useCallback((): TransportManager => {
    if (!managerRef.current) {
      managerRef.current = new TransportManager({
        roomId,
        enableBroadcast,
        enableWebRTC,
        enableWebSocket,
        autoReconnect,
        enableLeaderElection,
      });

      // Set up callbacks
      managerRef.current.onMessage = (msg) => {
        optionsRef.current.onMessage?.(msg);
      };

      managerRef.current.onStateChange = (state) => {
        setConnectionState(state);
        setIsConnected(state === "connected");
        setMyPeerId(managerRef.current?.myPeerId ?? null);
        setPeerCount(managerRef.current?.peerCount ?? 0);
        setIsLeader(managerRef.current?.isLeader ?? false);
        setLeaderRole(managerRef.current?.leaderRole ?? "unknown");
        onConnectionStateChange?.(state);
      };

      managerRef.current.onPeerConnect = (peerId) => {
        setPeerCount(managerRef.current?.peerCount ?? 0);
        optionsRef.current.onPeerConnect?.(peerId);
      };

      managerRef.current.onPeerDisconnect = (peerId) => {
        setPeerCount(managerRef.current?.peerCount ?? 0);
        optionsRef.current.onPeerDisconnect?.(peerId);
      };
    }
    return managerRef.current;
  }, [roomId, enableBroadcast, enableWebRTC, enableWebSocket, autoReconnect, enableLeaderElection, onConnectionStateChange]);

  // Connect
  const connect = useCallback(async () => {
    const manager = getManager();
    await manager.connect();
    // Update leader state after connect
    setIsLeader(manager.isLeader);
    setLeaderRole(manager.leaderRole);
  }, [getManager]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (managerRef.current) {
      await managerRef.current.disconnect();
    }
  }, []);

  // Reconnect
  const reconnect = useCallback(async () => {
    await disconnect();
    await connect();
  }, [connect, disconnect]);

  // Broadcast
  const broadcast = useCallback((data: ArrayBuffer | string) => {
    managerRef.current?.broadcast(data);
  }, []);

  // Send to specific peer
  const sendTo = useCallback((peerId: string, data: ArrayBuffer | string) => {
    managerRef.current?.sendTo(peerId, data);
  }, []);

  // Get time offset
  const getTimeOffset = useCallback((peerId: string): number => {
    return managerRef.current?.getTimeOffset(peerId) ?? 0;
  }, []);

  // Set time offset
  const setTimeOffset = useCallback((peerId: string, offset: number) => {
    managerRef.current?.setTimeOffset(peerId, offset);
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

  // Network awareness
  useEffect(() => {
    const handleOnline = () => {
      if (
        autoReconnect &&
        connectionState === "disconnected" &&
        managerRef.current
      ) {
        void connect();
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [autoReconnect, connectionState, connect]);

  return {
    connect,
    disconnect,
    reconnect,
    broadcast,
    sendTo,
    isConnected,
    connectionState,
    peerCount,
    myPeerId,
    isLeader,
    leaderRole,
    getTimeOffset,
    setTimeOffset,
  };
}
