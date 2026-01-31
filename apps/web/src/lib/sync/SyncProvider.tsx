import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useWebRTCRoom } from "@/hooks/useWebRTCRoom";
import type {
  SyncContextValue,
  SyncRegistration,
  TimeSyncMessage,
} from "./types";

export const SyncContext = createContext<SyncContextValue | null>(null);

interface ComponentRegistration {
  typeId: number;
  onRemoteEvent: (event: unknown) => void;
  getCurrentEvent: () => unknown | null;
  decode: (buffer: ArrayBuffer) => unknown | null;
  encode: (event: unknown) => ArrayBuffer;
}

export interface SyncProviderProps {
  roomId: string;
  children: ReactNode;
  /** Auto-join on mount (default: false) */
  autoJoin?: boolean;
}

/**
 * SyncProvider wraps WebRTC and provides:
 * - Peer-level time synchronization
 * - Message routing by typeId
 * - Component registration system
 */
export function SyncProvider({
  roomId,
  children,
  autoJoin = false,
}: SyncProviderProps) {
  // Track time offsets per peer: offset = localTime - remoteTime
  // To convert remote timestamp to local: remoteTimestamp + offset
  const timeOffsetsRef = useRef<Map<string, number>>(new Map());

  // Registered component handlers by typeId
  const registrationsRef = useRef<Map<number, ComponentRegistration>>(
    new Map()
  );

  // Handle incoming messages (binary events or JSON control messages)
  const handleMessage = useCallback((peerId: string, data: unknown) => {
    // Binary data - route by typeId (first byte)
    if (data instanceof ArrayBuffer) {
      const view = new DataView(data);
      const typeId = view.getUint8(0);

      const registration = registrationsRef.current.get(typeId);
      if (registration) {
        // Decode and apply (slice off typeId byte)
        const payload = data.slice(1);
        const event = registration.decode(payload);
        if (event) {
          registration.onRemoteEvent(event);
        }
      }
      return;
    }

    // JSON messages - time sync
    const msg = data as TimeSyncMessage;
    if (msg.type === "time-sync") {
      // offset converts remote timestamps to local time
      const offset = performance.now() - msg.localTime;
      timeOffsetsRef.current.set(peerId, offset);
    }
  }, []);

  // Handle new peer connections - exchange time sync and current state
  const handlePeerConnect = useCallback(
    (peerId: string) => {
      // Send our time for synchronization
      sendTo(peerId, {
        type: "time-sync",
        localTime: performance.now(),
      } as TimeSyncMessage);

      // Send current state for all registered components
      for (const [, registration] of registrationsRef.current) {
        const event = registration.getCurrentEvent();
        if (event) {
          const encoded = registration.encode(event);
          // Prepend typeId
          const withTypeId = new Uint8Array(encoded.byteLength + 1);
          withTypeId[0] = registration.typeId;
          withTypeId.set(new Uint8Array(encoded), 1);
          sendToBinary(peerId, withTypeId.buffer);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const {
    join,
    leave,
    broadcast,
    sendTo,
    isConnected,
    peerCount,
    peerId,
  } = useWebRTCRoom({
    roomId,
    onMessage: handleMessage,
    onPeerConnect: handlePeerConnect,
  });

  // Binary sendTo (need to add to useWebRTCRoom if not present)
  const sendToBinary = useCallback(
    (targetPeerId: string, data: ArrayBuffer) => {
      // For now, use sendTo which should handle ArrayBuffer
      sendTo(targetPeerId, data);
    },
    [sendTo]
  );

  // Auto-join if enabled
  useEffect(() => {
    if (autoJoin) {
      void join();
      return () => {
        void leave();
      };
    }
  }, [autoJoin, join, leave]);

  // Register a component type for syncing
  const register = useCallback(
    <TEvent, TState>(
      registration: SyncRegistration<TEvent, TState>,
      callbacks: {
        onRemoteEvent: (event: TEvent) => void;
        getCurrentEvent: () => TEvent | null;
      }
    ) => {
      const { codec } = registration;
      const typeId = codec.typeId;

      registrationsRef.current.set(typeId, {
        typeId,
        onRemoteEvent: callbacks.onRemoteEvent as (event: unknown) => void,
        getCurrentEvent: callbacks.getCurrentEvent as () => unknown | null,
        decode: codec.decode as (buffer: ArrayBuffer) => unknown | null,
        encode: codec.encode as (event: unknown) => ArrayBuffer,
      });

      // Return unregister function
      return () => {
        registrationsRef.current.delete(typeId);
      };
    },
    []
  );

  // Broadcast binary data (caller must prepend typeId)
  const broadcastData = useCallback(
    (data: ArrayBuffer) => {
      if (isConnected) {
        broadcast(data);
      }
    },
    [isConnected, broadcast]
  );

  // Get time offset for a specific peer
  const getTimeOffset = useCallback((targetPeerId: string): number => {
    return timeOffsetsRef.current.get(targetPeerId) ?? 0;
  }, []);

  // Get average time offset across all connected peers
  const getAverageTimeOffset = useCallback((): number => {
    const offsets = Array.from(timeOffsetsRef.current.values());
    if (offsets.length === 0) return 0;
    return offsets.reduce((a, b) => a + b, 0) / offsets.length;
  }, []);

  const contextValue: SyncContextValue = {
    isConnected,
    peerCount,
    peerId,
    join,
    leave,
    register,
    broadcast: broadcastData,
    getTimeOffset,
    getAverageTimeOffset,
  };

  return (
    <SyncContext.Provider value={contextValue}>{children}</SyncContext.Provider>
  );
}
