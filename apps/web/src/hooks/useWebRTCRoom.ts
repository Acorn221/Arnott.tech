import { useRef, useCallback, useEffect, useState } from "react";

// Use VITE_API_URL in production, empty string (relative) in dev
const API_BASE = import.meta.env.VITE_API_URL || "";

// Derive WebSocket URL from API base
function getWsUrl(): string {
  if (API_BASE) {
    // Production: convert https:// to wss://
    return API_BASE.replace(/^http/, "ws");
  }
  // Dev: connect directly to worker (Vite proxy doesn't handle WS well)
  if (import.meta.env.DEV) {
    return "ws://localhost:8787";
  }
  // Fallback: use current host
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

const WS_BASE = getWsUrl();

const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;
const DEFAULT_BACKOFF = {
  initial: 1000,
  max: 30000,
  multiplier: 2,
};
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  connected: boolean;
  remoteDescriptionSet: boolean;
  pendingCandidates: RTCIceCandidateInit[];
}

interface Signal {
  type: string;
  from: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

interface WelcomeMessage {
  type: "welcome";
  peerId: string;
  peers: string[];
}

interface PeerMessage {
  type: "peer-joined" | "peer-left";
  peerId: string;
}

type ServerMessage = WelcomeMessage | PeerMessage | Signal;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface ReconnectBackoff {
  initial: number;
  max: number;
  multiplier: number;
}

export interface UseWebRTCRoomOptions {
  roomId?: string;
  autoConnect?: boolean;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectBackoff?: ReconnectBackoff;
  onMessage?: (peerId: string, data: unknown) => void;
  onPeerConnect?: (peerId: string) => void;
  onPeerDisconnect?: (peerId: string) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
}

export interface UseWebRTCRoomReturn {
  join: () => Promise<void>;
  leave: () => Promise<void>;
  broadcast: (data: unknown) => void;
  sendTo: (peerId: string, data: unknown) => void;
  isConnected: boolean;
  peerCount: number;
  peerId: string | null;
  connectionState: ConnectionState;
  reconnectAttempt: number;
  reconnect: () => Promise<void>;
}

export function useWebRTCRoom(
  options: UseWebRTCRoomOptions = {}
): UseWebRTCRoomReturn {
  const {
    roomId = "default",
    autoConnect = false,
    autoReconnect = false,
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
    reconnectBackoff = DEFAULT_BACKOFF,
    onMessage,
    onPeerConnect,
    onPeerDisconnect,
    onConnectionStateChange,
  } = options;

  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const myPeerIdRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const reconnectTimeoutRef = useRef<number | null>(null);
  const intentionalDisconnectRef = useRef(false);
  const isJoiningRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const updatePeerCount = useCallback(() => {
    const connectedCount = Array.from(peerConnectionsRef.current.values()).filter(
      (p) => p.connected
    ).length;
    setPeerCount(connectedCount);
  }, []);

  // Helper to update connection state and notify callback
  const updateConnectionState = useCallback((newState: ConnectionState) => {
    setConnectionState((prevState) => {
      if (prevState !== newState) {
        onConnectionStateChange?.(newState);
      }
      return newState;
    });
  }, [onConnectionStateChange]);

  // Calculate backoff delay for reconnection
  const getBackoffDelay = useCallback((attempt: number): number => {
    const { initial, max, multiplier } = reconnectBackoff;
    return Math.min(initial * Math.pow(multiplier, attempt), max);
  }, [reconnectBackoff]);

  // Send signal via WebSocket
  const sendSignal = useCallback((type: string, to: string, payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, to, ...payload }));
    }
  }, []);

  const processPendingCandidates = useCallback(async (peerConn: PeerConnection) => {
    if (peerConn.pendingCandidates.length > 0) {
      for (const candidate of peerConn.pendingCandidates) {
        try {
          await peerConn.connection.addIceCandidate(candidate);
        } catch {
          // Ignore candidate errors
        }
      }
      peerConn.pendingCandidates = [];
    }
  }, []);

  const createPeerConnection = useCallback(
    (localPeerId: string, remotePeerId: string, isInitiator: boolean): PeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      const peerConn: PeerConnection = {
        peerId: remotePeerId,
        connection: pc,
        dataChannel: null,
        connected: false,
        remoteDescriptionSet: false,
        pendingCandidates: [],
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal("ice", remotePeerId, {
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          if (!peerConn.connected) {
            peerConn.connected = true;
            updatePeerCount();
            optionsRef.current.onPeerConnect?.(remotePeerId);
          }
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          if (!peerConn.connected) {
            peerConn.connected = true;
            updatePeerCount();
            optionsRef.current.onPeerConnect?.(remotePeerId);
          }
        } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          if (peerConn.connected) {
            peerConn.connected = false;
            updatePeerCount();
            optionsRef.current.onPeerDisconnect?.(remotePeerId);
          }
        }
      };

      const setupDataChannel = (channel: RTCDataChannel) => {
        channel.onopen = () => {
          peerConn.dataChannel = channel;
          if (!peerConn.connected) {
            peerConn.connected = true;
            updatePeerCount();
            optionsRef.current.onPeerConnect?.(remotePeerId);
          }
        };

        channel.onclose = () => {
          if (peerConn.connected) {
            peerConn.connected = false;
            updatePeerCount();
            optionsRef.current.onPeerDisconnect?.(remotePeerId);
          }
        };

        channel.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
          if (event.data instanceof ArrayBuffer) {
            optionsRef.current.onMessage?.(remotePeerId, event.data);
            return;
          }
          try {
            const data = JSON.parse(event.data) as unknown;
            optionsRef.current.onMessage?.(remotePeerId, data);
          } catch {
            optionsRef.current.onMessage?.(remotePeerId, event.data);
          }
        };
      };

      if (isInitiator) {
        // Use unreliable, unordered delivery for real-time streaming (UDP-like)
        const dataChannel = pc.createDataChannel("data", {
          ordered: false,
          maxRetransmits: 0,
        });
        setupDataChannel(dataChannel);
        peerConn.dataChannel = dataChannel;
      } else {
        pc.ondatachannel = (event) => {
          setupDataChannel(event.channel);
        };
      }

      peerConnectionsRef.current.set(remotePeerId, peerConn);
      return peerConn;
    },
    [sendSignal, updatePeerCount]
  );

  const initiateConnection = useCallback(
    async (localPeerId: string, remotePeerId: string) => {
      if (peerConnectionsRef.current.has(remotePeerId)) {
        return;
      }

      const peerConn = createPeerConnection(localPeerId, remotePeerId, true);

      try {
        const offer = await peerConn.connection.createOffer();
        await peerConn.connection.setLocalDescription(offer);
        sendSignal("offer", remotePeerId, { sdp: offer.sdp });
      } catch {
        // Connection failed
      }
    },
    [createPeerConnection, sendSignal]
  );

  const handleSignal = useCallback(
    async (localPeerId: string, signal: Signal) => {
      const { type, from, sdp, candidate } = signal;

      let peerConn = peerConnectionsRef.current.get(from);

      if (type === "offer") {
        if (!peerConn) {
          peerConn = createPeerConnection(localPeerId, from, false);
        }

        try {
          await peerConn.connection.setRemoteDescription({ type: "offer", sdp });
          peerConn.remoteDescriptionSet = true;
          await processPendingCandidates(peerConn);

          const answer = await peerConn.connection.createAnswer();
          await peerConn.connection.setLocalDescription(answer);
          sendSignal("answer", from, { sdp: answer.sdp });
        } catch {
          // Offer handling failed
        }
      } else if (type === "answer") {
        if (peerConn) {
          try {
            await peerConn.connection.setRemoteDescription({ type: "answer", sdp });
            peerConn.remoteDescriptionSet = true;
            await processPendingCandidates(peerConn);
          } catch {
            // Answer handling failed
          }
        }
      } else if (type === "ice" && candidate) {
        if (peerConn?.remoteDescriptionSet) {
          try {
            await peerConn.connection.addIceCandidate(candidate);
          } catch {
            // ICE candidate failed
          }
        } else if (peerConn) {
          peerConn.pendingCandidates.push(candidate);
        }
      }
    },
    [createPeerConnection, sendSignal, processPendingCandidates]
  );

  const handlePeerLeft = useCallback((peerId: string) => {
    const peerConn = peerConnectionsRef.current.get(peerId);
    if (peerConn) {
      peerConn.dataChannel?.close();
      peerConn.connection.close();
      peerConnectionsRef.current.delete(peerId);
      if (peerConn.connected) {
        updatePeerCount();
        optionsRef.current.onPeerDisconnect?.(peerId);
      }
    }
  }, [updatePeerCount]);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    for (const [, peerConn] of peerConnectionsRef.current) {
      peerConn.dataChannel?.close();
      peerConn.connection.close();
    }
    peerConnectionsRef.current.clear();
    setPeerCount(0);
  }, []);

  // Attempt to reconnect with exponential backoff
  const attemptReconnect = useCallback(() => {
    if (intentionalDisconnectRef.current) {
      return;
    }

    if (!navigator.onLine) {
      // Wait for online event to trigger reconnect
      return;
    }

    setReconnectAttempt((current) => {
      if (current >= maxReconnectAttempts) {
        updateConnectionState('disconnected');
        return current;
      }

      updateConnectionState('reconnecting');
      const delay = getBackoffDelay(current);

      reconnectTimeoutRef.current = window.setTimeout(() => {
        void join();
      }, delay);

      return current + 1;
    });
  }, [maxReconnectAttempts, getBackoffDelay, updateConnectionState]);

  const join = useCallback(async () => {
    // Prevent concurrent join operations
    if (isJoiningRef.current) {
      return;
    }
    isJoiningRef.current = true;

    try {
      // Cancel any pending reconnect attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Clean up any existing connections before joining
      cleanup();

      intentionalDisconnectRef.current = false;
      updateConnectionState('connecting');

      // Connect via WebSocket
      const ws = new WebSocket(`${WS_BASE}/api/signal/ws?roomId=${encodeURIComponent(roomId)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        // Connected, waiting for welcome message
      };

      ws.onmessage = async (event) => {
        let data: ServerMessage;
        try {
          data = JSON.parse(event.data as string) as ServerMessage;
        } catch {
          return;
        }

        if (data.type === "welcome") {
          const { peerId, peers } = data as WelcomeMessage;
          myPeerIdRef.current = peerId;
          setMyPeerId(peerId);
          setIsConnected(true);
          setReconnectAttempt(0);
          updateConnectionState('connected');

          // Initiate connections to existing peers
          if (peers.length > 0) {
            peerConnectionStartTimeRef.current = Date.now();
            for (const remotePeerId of peers) {
              await initiateConnection(peerId, remotePeerId);
            }
          }
        } else if (data.type === "peer-joined") {
          // New peer joined - they will initiate the connection to us
        } else if (data.type === "peer-left") {
          handlePeerLeft((data as PeerMessage).peerId);
        } else if (data.type === "offer" || data.type === "answer" || data.type === "ice") {
          const peerId = myPeerIdRef.current;
          if (peerId) {
            await handleSignal(peerId, data as Signal);
          }
        }
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) {
          return;
        }

        wsRef.current = null;
        setIsConnected(false);

        if (!intentionalDisconnectRef.current) {
          updateConnectionState('disconnected');
          if (autoReconnect) {
            attemptReconnect();
          }
        }
      };

      ws.onerror = () => {
        // Error handled by onclose
      };
    } finally {
      isJoiningRef.current = false;
    }
  }, [roomId, initiateConnection, handleSignal, handlePeerLeft, updateConnectionState, cleanup, autoReconnect, attemptReconnect]);

  const leave = useCallback(async () => {
    intentionalDisconnectRef.current = true;
    cleanup();

    myPeerIdRef.current = null;
    setMyPeerId(null);
    setIsConnected(false);
    setReconnectAttempt(0);
    updateConnectionState('disconnected');
  }, [cleanup, updateConnectionState]);

  // Manual reconnect trigger
  const reconnect = useCallback(async () => {
    intentionalDisconnectRef.current = false;
    setReconnectAttempt(0);

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    await join();
  }, [join]);

  const broadcast = useCallback((data: unknown) => {
    for (const [, peerConn] of peerConnectionsRef.current) {
      if (peerConn.dataChannel?.readyState !== "open") {
        continue;
      }
      if (data instanceof ArrayBuffer) {
        peerConn.dataChannel.send(data);
      } else {
        peerConn.dataChannel.send(JSON.stringify(data));
      }
    }
  }, []);

  const sendTo = useCallback((peerId: string, data: unknown) => {
    const peerConn = peerConnectionsRef.current.get(peerId);
    if (peerConn?.dataChannel?.readyState === "open") {
      peerConn.dataChannel.send(JSON.stringify(data));
    }
  }, []);

  // Track when we started connecting to peers (to avoid premature reconnects)
  const peerConnectionStartTimeRef = useRef<number | null>(null);

  // Check if all peers disconnected and trigger reconnect
  useEffect(() => {
    if (!autoReconnect || intentionalDisconnectRef.current || !isConnected) {
      return;
    }

    const connections = peerConnectionsRef.current;
    if (connections.size === 0) {
      return;
    }

    const allDisconnected = Array.from(connections.values()).every(
      (conn) => !conn.connected
    );

    // Only reconnect if enough time has passed since we started trying to connect
    if (allDisconnected && peerCount === 0) {
      const startTime = peerConnectionStartTimeRef.current;
      const elapsed = startTime ? Date.now() - startTime : 0;

      // Give WebRTC 10 seconds to establish before considering it failed
      if (elapsed > 10000) {
        attemptReconnect();
      }
    }
  }, [autoReconnect, isConnected, peerCount, attemptReconnect]);

  // Network awareness - online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (autoReconnect && connectionState === 'disconnected' && !intentionalDisconnectRef.current) {
        setReconnectAttempt(0);
        attemptReconnect();
      }
    };

    const handleOffline = () => {
      // Cancel pending reconnect when offline
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [autoReconnect, connectionState, attemptReconnect]);

  // Autoconnect on mount
  useEffect(() => {
    if (autoConnect) {
      void join();
    }

    return () => {
      if (autoConnect) {
        intentionalDisconnectRef.current = true;
        void leave();
      }
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    join,
    leave,
    broadcast,
    sendTo,
    isConnected,
    peerCount,
    peerId: myPeerId,
    connectionState,
    reconnectAttempt,
    reconnect,
  };
}
