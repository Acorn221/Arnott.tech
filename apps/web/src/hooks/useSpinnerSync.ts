import { useRef, useEffect, useCallback, useState } from "react";
import type { SpinnerState, SpinnerMessage } from "@arnott/shared";
import { getSpinnerWebSocketUrl } from "../lib/trpc";

interface UseSpinnerSyncOptions {
  roomId?: string;
  enabled?: boolean;
  onStateUpdate?: (state: SpinnerState) => void;
  onUserJoin?: (userId: string) => void;
  onUserLeave?: (userId: string) => void;
}

interface UseSpinnerSyncReturn {
  isConnected: boolean;
  connectedUsers: number;
  sendState: (state: Partial<SpinnerState>) => void;
  remoteState: SpinnerState | null;
  userId: string | null;
}

const RECONNECT_DELAY = 2000;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Hook for syncing spinner state across clients via WebSocket
 */
export function useSpinnerSync(
  options: UseSpinnerSyncOptions = {}
): UseSpinnerSyncReturn {
  const { roomId = "default", enabled = true, onStateUpdate, onUserJoin, onUserLeave } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const userIdRef = useRef<string | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState(0);
  const [remoteState, setRemoteState] = useState<SpinnerState | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;

    const url = getSpinnerWebSocketUrl(roomId);
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log("[SpinnerSync] Connected to room:", roomId);
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as SpinnerMessage;

        switch (message.type) {
          case "state":
          case "sync":
            setRemoteState(message.payload);
            onStateUpdate?.(message.payload);
            break;

          case "join":
            userIdRef.current = message.payload.userId;
            setConnectedUsers((prev) => prev + 1);
            onUserJoin?.(message.payload.userId);
            break;

          case "leave":
            setConnectedUsers((prev) => Math.max(0, prev - 1));
            onUserLeave?.(message.payload.userId);
            break;
        }
      } catch (e) {
        console.error("[SpinnerSync] Failed to parse message:", e);
      }
    };

    ws.onclose = () => {
      console.log("[SpinnerSync] Disconnected");
      setIsConnected(false);
      wsRef.current = null;

      // Attempt to reconnect
      if (
        enabled &&
        reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS
      ) {
        reconnectAttempts.current++;
        console.log(
          `[SpinnerSync] Reconnecting in ${RECONNECT_DELAY}ms (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`
        );
        reconnectTimeout.current = setTimeout(connect, RECONNECT_DELAY);
      }
    };

    ws.onerror = (error) => {
      console.error("[SpinnerSync] WebSocket error:", error);
    };

    wsRef.current = ws;
  }, [enabled, roomId, onStateUpdate, onUserJoin, onUserLeave]);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendState = useCallback((state: Partial<SpinnerState>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: SpinnerMessage = {
        type: "sync",
        payload: {
          rotation: state.rotation ?? 0,
          angularVelocity: state.angularVelocity ?? 0,
          isDragging: state.isDragging ?? false,
          draggingUserId: state.isDragging ? userIdRef.current : null,
          timestamp: Date.now(),
          spinCount: state.spinCount ?? 0,
        },
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }
    return () => disconnect();
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    connectedUsers,
    sendState,
    remoteState,
    userId: userIdRef.current,
  };
}
