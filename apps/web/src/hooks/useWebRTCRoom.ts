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

interface Peer {
  id: string;
  // WebRTC state
  rtcConnection: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  rtcConnected: boolean;
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
    onConnectionStateChange,
  } = options;

  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const myPeerIdRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // Track all known peers (from WebSocket) with their transport status
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const reconnectTimeoutRef = useRef<number | null>(null);
  const intentionalDisconnectRef = useRef(false);
  const isJoiningRef = useRef(false);
  // Store options in ref to access latest values in event handlers
  // without adding them to dependency arrays (which would cause reconnects)
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Update peer count from peers map (WebSocket-based, not WebRTC)
  const updatePeerCount = useCallback(() => {
    setPeerCount(peersRef.current.size);
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

  const processPendingCandidates = useCallback(async (peer: Peer) => {
    if (peer.pendingCandidates.length > 0 && peer.rtcConnection) {
      for (const candidate of peer.pendingCandidates) {
        try {
          await peer.rtcConnection.addIceCandidate(candidate);
        } catch {
          // Ignore candidate errors
        }
      }
      peer.pendingCandidates = [];
    }
  }, []);

  const createPeerConnection = useCallback(
    (remotePeerId: string, isInitiator: boolean): Peer => {
      // Get or create peer entry
      let peer = peersRef.current.get(remotePeerId);
      if (!peer) {
        peer = {
          id: remotePeerId,
          rtcConnection: null,
          dataChannel: null,
          rtcConnected: false,
          remoteDescriptionSet: false,
          pendingCandidates: [],
        };
        peersRef.current.set(remotePeerId, peer);
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peer.rtcConnection = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal("ice", remotePeerId, {
            candidate: event.candidate.toJSON(),
          });
        }
      };

      // Handle WebRTC disconnection (peer is still known via WebSocket)
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
          const p = peersRef.current.get(remotePeerId);
          if (p?.rtcConnected) {
            p.rtcConnected = false;
          }
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          const p = peersRef.current.get(remotePeerId);
          if (p?.rtcConnected) {
            p.rtcConnected = false;
          }
        }
      };

      const setupDataChannel = (channel: RTCDataChannel) => {
        channel.onopen = () => {
          const p = peersRef.current.get(remotePeerId);
          if (p) {
            p.dataChannel = channel;
            p.rtcConnected = true;
            optionsRef.current.onPeerConnect?.(remotePeerId);
          }
        };

        channel.onclose = () => {
          const p = peersRef.current.get(remotePeerId);
          if (p?.rtcConnected) {
            p.rtcConnected = false;
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
        peer.dataChannel = dataChannel;
      } else {
        pc.ondatachannel = (event) => {
          const p = peersRef.current.get(remotePeerId);
          if (p) {
            p.dataChannel = event.channel;
          }
          setupDataChannel(event.channel);
        };
      }

      return peer;
    },
    [sendSignal]
  );

  const initiateConnection = useCallback(
    async (remotePeerId: string) => {
      const existingPeer = peersRef.current.get(remotePeerId);
      // Skip if already have an RTC connection for this peer
      if (existingPeer?.rtcConnection) {
        return;
      }

      const peer = createPeerConnection(remotePeerId, true);

      try {
        const offer = await peer.rtcConnection!.createOffer();
        await peer.rtcConnection!.setLocalDescription(offer);
        sendSignal("offer", remotePeerId, { sdp: offer.sdp });
      } catch {
        // Connection failed - peer stays in WebSocket-only mode
      }
    },
    [createPeerConnection, sendSignal]
  );

  const handleSignal = useCallback(
    async (signal: Signal) => {
      const { type, from, sdp, candidate } = signal;

      let peer = peersRef.current.get(from);

      if (type === "offer") {
        if (!peer?.rtcConnection) {
          peer = createPeerConnection(from, false);
        }

        try {
          await peer.rtcConnection!.setRemoteDescription({ type: "offer", sdp });
          peer.remoteDescriptionSet = true;
          await processPendingCandidates(peer);

          const answer = await peer.rtcConnection!.createAnswer();
          await peer.rtcConnection!.setLocalDescription(answer);
          sendSignal("answer", from, { sdp: answer.sdp });
        } catch {
          // Offer handling failed
        }
      } else if (type === "answer") {
        if (peer?.rtcConnection) {
          try {
            await peer.rtcConnection.setRemoteDescription({ type: "answer", sdp });
            peer.remoteDescriptionSet = true;
            await processPendingCandidates(peer);
          } catch {
            // Answer handling failed
          }
        }
      } else if (type === "ice" && candidate) {
        if (peer?.remoteDescriptionSet && peer.rtcConnection) {
          try {
            await peer.rtcConnection.addIceCandidate(candidate);
          } catch {
            // ICE candidate failed
          }
        } else if (peer) {
          peer.pendingCandidates.push(candidate);
        }
      }
    },
    [createPeerConnection, sendSignal, processPendingCandidates]
  );

  const handlePeerLeft = useCallback((peerId: string) => {
    const peer = peersRef.current.get(peerId);
    if (peer) {
      peer.dataChannel?.close();
      peer.rtcConnection?.close();
      peersRef.current.delete(peerId);
      updatePeerCount();
      optionsRef.current.onPeerDisconnect?.(peerId);
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

    for (const [, peer] of peersRef.current) {
      peer.dataChannel?.close();
      peer.rtcConnection?.close();
    }
    peersRef.current.clear();
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
      ws.binaryType = "arraybuffer"; // Ensure binary messages come as ArrayBuffer, not Blob
      wsRef.current = ws;

      ws.onopen = () => {
        // Connected, waiting for welcome message
      };

      ws.onmessage = async (event) => {
        // Binary data = relayed spinner event from another peer
        if (event.data instanceof ArrayBuffer) {
          optionsRef.current.onMessage?.("ws-relay", event.data);
          return;
        }

        // Check for other binary types (Blob shouldn't happen with binaryType=arraybuffer)
        if (typeof event.data !== "string") {
          return;
        }

        // JSON = signaling message
        let data: ServerMessage;
        try {
          data = JSON.parse(event.data) as ServerMessage;
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

          // Add all existing peers to our peers map
          for (const remotePeerId of peers) {
            peersRef.current.set(remotePeerId, {
              id: remotePeerId,
              rtcConnection: null,
              dataChannel: null,
              rtcConnected: false,
              remoteDescriptionSet: false,
              pendingCandidates: [],
            });
          }
          setPeerCount(peers.length);

          // Try to establish WebRTC connections
          for (const remotePeerId of peers) {
            await initiateConnection(remotePeerId);
          }
        } else if (data.type === "peer-joined") {
          const { peerId: joinedPeerId } = data as PeerMessage;
          // Add new peer - they will initiate WebRTC connection to us
          peersRef.current.set(joinedPeerId, {
            id: joinedPeerId,
            rtcConnection: null,
            dataChannel: null,
            rtcConnected: false,
            remoteDescriptionSet: false,
            pendingCandidates: [],
          });
          updatePeerCount();
        } else if (data.type === "peer-left") {
          handlePeerLeft((data as PeerMessage).peerId);
        } else if (data.type === "offer" || data.type === "answer" || data.type === "ice") {
          if (myPeerIdRef.current) {
            await handleSignal(data);
          }
        }
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) {
          return;
        }

        wsRef.current = null;
        setIsConnected(false);
        // Clear peers on disconnect
        peersRef.current.clear();
        setPeerCount(0);

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

  // Broadcast to all peers - uses WebRTC if available, falls back to WebSocket
  const broadcast = useCallback((data: unknown) => {
    const isBinary = data instanceof ArrayBuffer;
    let hasWsOnlyPeers = false;

    // Send to peers with WebRTC data channels
    for (const [, peer] of peersRef.current) {
      if (peer.rtcConnected && peer.dataChannel?.readyState === "open") {
        if (isBinary) {
          peer.dataChannel.send(data);
        } else {
          peer.dataChannel.send(JSON.stringify(data));
        }
      } else {
        // This peer doesn't have WebRTC, need to use WebSocket
        hasWsOnlyPeers = true;
      }
    }

    // Send via WebSocket relay if there are any peers without WebRTC
    if (hasWsOnlyPeers && wsRef.current?.readyState === WebSocket.OPEN) {
      if (isBinary) {
        // Binary data - server will broadcast to all other peers
        wsRef.current.send(data);
      } else {
        // JSON data - wrap in relay envelope (server broadcasts to others)
        wsRef.current.send(JSON.stringify({ type: "relay-json", data }));
      }
    }
  }, []);

  const sendTo = useCallback((peerId: string, data: unknown) => {
    const peer = peersRef.current.get(peerId);
    if (peer?.rtcConnected && peer.dataChannel?.readyState === "open") {
      peer.dataChannel.send(JSON.stringify(data));
    }
  }, []);

  // No need for WebRTC reconnect logic - we use WebSocket fallback now

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
