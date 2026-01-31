import { useEffect, useState, useCallback } from "react";
import * as SignalingSocket from "@/lib/SignalingSocket";

export interface UseSignalingReturn {
  connected: boolean;
  peerId: string | null;
  peerCount: number;
  peers: string[];
  send: (data: unknown) => boolean;
  sendTo: (to: string, type: string, payload: Record<string, unknown>) => boolean;
  onMessage: (handler: (data: unknown) => void) => () => void;
}

/**
 * React hook for signaling WebSocket.
 * The WebSocket is managed as a singleton outside React.
 */
export function useSignaling(): UseSignalingReturn {
  const [state, setState] = useState(() => SignalingSocket.getState());

  useEffect(() => {
    return SignalingSocket.onStateChange((connected, peerId, peerCount) => {
      setState({
        connected,
        peerId,
        peerCount,
        peers: SignalingSocket.getState().peers,
      });
    });
  }, []);

  const send = useCallback((data: unknown) => SignalingSocket.send(data), []);
  const sendTo = useCallback(
    (to: string, type: string, payload: Record<string, unknown>) =>
      SignalingSocket.sendTo(to, type, payload),
    []
  );
  const onMessage = useCallback(
    (handler: (data: unknown) => void) => SignalingSocket.onMessage(handler),
    []
  );

  return {
    ...state,
    send,
    sendTo,
    onMessage,
  };
}
