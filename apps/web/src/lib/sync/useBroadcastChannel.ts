import { useRef, useCallback, useEffect } from 'react';

export interface UseBroadcastChannelOptions<T = unknown> {
  channelName: string;
  onMessage: (data: T, source: 'local-tab') => void;
  enabled?: boolean;
}

export interface UseBroadcastChannelReturn<T = unknown> {
  broadcast: (data: T) => void;
  isSupported: boolean;
}

/**
 * Hook for same-browser tab-to-tab communication using BroadcastChannel API.
 *
 * Benefits:
 * - Instant sync between tabs (~1ms vs WebRTC latency)
 * - Works even if WebRTC fails
 * - Reduces signaling server load
 * - Well-supported in all modern browsers
 *
 * Usage:
 * ```tsx
 * const { broadcast } = useBroadcastChannel({
 *   channelName: `spinner-sync-${roomId}`,
 *   onMessage: (data) => {
 *     // Handle message from other tabs
 *   },
 * });
 *
 * // Broadcast to other tabs
 * broadcast({ type: 'event', payload: data });
 * ```
 */
export function useBroadcastChannel<T = unknown>(
  options: UseBroadcastChannelOptions<T>
): UseBroadcastChannelReturn<T> {
  const { channelName, onMessage, enabled = true } = options;
  const channelRef = useRef<BroadcastChannel | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Check if BroadcastChannel is supported
  const isSupported = typeof BroadcastChannel !== 'undefined';

  useEffect(() => {
    if (!isSupported || !enabled) {
      return;
    }

    // Create channel
    channelRef.current = new BroadcastChannel(channelName);

    // Handle incoming messages
    channelRef.current.onmessage = (event: MessageEvent<T>) => {
      onMessageRef.current(event.data, 'local-tab');
    };

    // Handle errors
    channelRef.current.onmessageerror = () => {
      // Message couldn't be deserialized, ignore
    };

    return () => {
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [channelName, isSupported, enabled]);

  const broadcast = useCallback((data: T) => {
    if (channelRef.current && enabled) {
      try {
        channelRef.current.postMessage(data);
      } catch {
        // Message couldn't be serialized, ignore
      }
    }
  }, [enabled]);

  return {
    broadcast,
    isSupported,
  };
}
