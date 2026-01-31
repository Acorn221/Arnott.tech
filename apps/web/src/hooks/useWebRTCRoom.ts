import { useRef, useCallback, useEffect, useState } from "react";

const POLL_INTERVAL_FAST = 500;
const POLL_INTERVAL_SLOW = 2500;
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

interface JoinResponse {
  peerId?: string;
  peers?: string[];
}

interface PollResponse {
  signals?: Signal[];
}

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
  const pollIntervalRef = useRef<number | null>(null);
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const expectedPeersRef = useRef<Set<string>>(new Set());
  const currentPollIntervalRef = useRef<number>(POLL_INTERVAL_FAST);
  const pollSignalsRef = useRef<(() => Promise<void>) | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isVisibleRef = useRef(true);
  const intentionalDisconnectRef = useRef(false);
  const isJoiningRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const adjustPollInterval = useCallback(() => {
    const pollSignalsFn = pollSignalsRef.current;
    if (!pollSignalsFn || !pollIntervalRef.current) return;

    const connections = peerConnectionsRef.current;
    const expectedPeers = expectedPeersRef.current;

    // Check if all expected peers are connected
    const allConnected = expectedPeers.size === 0 ||
      Array.from(expectedPeers).every(peerId => {
        const conn = connections.get(peerId);
        return conn?.connected;
      });

    const desiredInterval = allConnected ? POLL_INTERVAL_SLOW : POLL_INTERVAL_FAST;

    // Only restart interval if it changed
    if (desiredInterval !== currentPollIntervalRef.current) {
      currentPollIntervalRef.current = desiredInterval;
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = window.setInterval(() => {
        // Only poll when tab is visible
        if (isVisibleRef.current) {
          void pollSignalsFn();
        }
      }, desiredInterval);
    }
  }, []);

  const updatePeerCount = useCallback(() => {
    const connectedCount = Array.from(peerConnectionsRef.current.values()).filter(
      (p) => p.connected
    ).length;
    setPeerCount(connectedCount);
    // Adjust polling speed based on connection state
    adjustPollInterval();
  }, [adjustPollInterval]);

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

  const sendSignal = useCallback(
    async <T,>(endpoint: string, data: Record<string, unknown>): Promise<T | null> => {
      try {
        const res = await fetch(`/api/signal/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        return (await res.json()) as T;
      } catch {
        return null;
      }
    },
    []
  );

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
          void sendSignal("ice", {
            from: localPeerId,
            to: remotePeerId,
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
          // Binary data passed through directly
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
      // Skip if we already have a connection to this peer
      if (peerConnectionsRef.current.has(remotePeerId)) {
        return;
      }

      const peerConn = createPeerConnection(localPeerId, remotePeerId, true);

      try {
        const offer = await peerConn.connection.createOffer();
        await peerConn.connection.setLocalDescription(offer);
        await sendSignal("offer", {
          from: localPeerId,
          to: remotePeerId,
          sdp: offer.sdp,
        });
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
        // New peer joining - track them and speed up polling
        if (!expectedPeersRef.current.has(from)) {
          expectedPeersRef.current.add(from);
          adjustPollInterval();
        }
        if (!peerConn) {
          peerConn = createPeerConnection(localPeerId, from, false);
        }

        try {
          await peerConn.connection.setRemoteDescription({ type: "offer", sdp });
          peerConn.remoteDescriptionSet = true;
          await processPendingCandidates(peerConn);

          const answer = await peerConn.connection.createAnswer();
          await peerConn.connection.setLocalDescription(answer);
          await sendSignal("answer", {
            from: localPeerId,
            to: from,
            sdp: answer.sdp,
          });
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
        // Only process ICE candidates for peers we already know about
        if (peerConn?.remoteDescriptionSet) {
          try {
            await peerConn.connection.addIceCandidate(candidate);
          } catch {
            // ICE candidate failed
          }
        } else if (peerConn) {
          peerConn.pendingCandidates.push(candidate);
        }
        // Ignore ICE candidates for unknown peers (likely stale)
      }
    },
    [createPeerConnection, sendSignal, processPendingCandidates, adjustPollInterval]
  );

  const pollSignals = useCallback(async () => {
    const peerId = myPeerIdRef.current;
    if (!peerId) return;

    try {
      const res = await fetch(`/api/signal/poll/${peerId}`);
      const data = (await res.json()) as PollResponse;

      if (data.signals && data.signals.length > 0) {
        for (const signal of data.signals) {
          await handleSignal(peerId, signal);
        }
      }
    } catch {
      // Polling error, ignore
    }
  }, [handleSignal]);

  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
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
    expectedPeersRef.current.clear();
    currentPollIntervalRef.current = POLL_INTERVAL_FAST;
    pollSignalsRef.current = null;
    setPeerCount(0);
  }, []);

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

      const result = await sendSignal<JoinResponse>("join", { roomId });
      if (!result?.peerId) {
        updateConnectionState('disconnected');
        return;
      }

      const peerId = result.peerId;
      myPeerIdRef.current = peerId;
      setMyPeerId(peerId);
      setIsConnected(true);
      setReconnectAttempt(0);
      updateConnectionState('connected');

      // Track expected peers for adaptive polling (exclude self if server includes it)
      const otherPeers = (result.peers || []).filter(p => p !== peerId);
      expectedPeersRef.current = new Set(otherPeers);
      currentPollIntervalRef.current = POLL_INTERVAL_FAST;

      if (otherPeers.length > 0) {
        for (const remotePeerId of otherPeers) {
          await new Promise((r) => setTimeout(r, 100));
          await initiateConnection(peerId, remotePeerId);
        }
      }

      // Store pollSignals ref for adaptive polling
      pollSignalsRef.current = pollSignals;

      pollIntervalRef.current = window.setInterval(() => {
        if (isVisibleRef.current) {
          void pollSignals();
        }
      }, POLL_INTERVAL_FAST);
    } finally {
      isJoiningRef.current = false;
    }
  }, [roomId, sendSignal, initiateConnection, pollSignals, updateConnectionState, cleanup]);

  const leave = useCallback(async () => {
    intentionalDisconnectRef.current = true;
    cleanup();

    const peerId = myPeerIdRef.current;
    if (peerId) {
      await sendSignal("leave", { roomId, peerId });
    }

    myPeerIdRef.current = null;
    setMyPeerId(null);
    setIsConnected(false);
    setReconnectAttempt(0);
    updateConnectionState('disconnected');
  }, [roomId, sendSignal, cleanup, updateConnectionState]);

  // Attempt to reconnect with exponential backoff
  const attemptReconnect = useCallback(async () => {
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
        void join().catch(() => {
          // If join fails, attempt again
          void attemptReconnect();
        });
      }, delay);

      return current + 1;
    });
  }, [maxReconnectAttempts, getBackoffDelay, updateConnectionState, join]);

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
      const channel = peerConn.dataChannel;
      // Binary for ArrayBuffer, JSON for objects
      if (data instanceof ArrayBuffer) {
        channel.send(data);
      } else {
        channel.send(JSON.stringify(data));
      }
    }
  }, []);

  const sendTo = useCallback((peerId: string, data: unknown) => {
    const peerConn = peerConnectionsRef.current.get(peerId);
    if (peerConn?.dataChannel?.readyState === "open") {
      peerConn.dataChannel.send(JSON.stringify(data));
    }
  }, []);

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

    if (allDisconnected && peerCount === 0) {
      void attemptReconnect();
    }
  }, [autoReconnect, isConnected, peerCount, attemptReconnect]);

  // Network awareness - online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (autoReconnect && connectionState === 'disconnected' && !intentionalDisconnectRef.current) {
        setReconnectAttempt(0);
        void attemptReconnect();
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

  // Visibility-aware polling
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible';

      if (isVisibleRef.current && isConnected) {
        // Resume polling immediately when visible
        void pollSignals();
        // Reset to fast polling to catch up
        adjustPollInterval();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, pollSignals, adjustPollInterval]);

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

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const peerId = myPeerIdRef.current;
      if (peerId) {
        navigator.sendBeacon(
          "/api/signal/leave",
          JSON.stringify({ roomId, peerId })
        );
      }
      cleanup();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [roomId, cleanup]);

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
