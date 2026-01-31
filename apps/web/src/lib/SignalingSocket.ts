/**
 * Singleton WebSocket manager for signaling.
 * Lives outside React to avoid lifecycle issues.
 */

type MessageHandler = (data: unknown) => void;
type StateHandler = (connected: boolean, peerId: string | null, peerCount: number) => void;

interface SignalingState {
  ws: WebSocket | null;
  peerId: string | null;
  connectedPeers: Set<string>;
  messageHandlers: Set<MessageHandler>;
  stateHandlers: Set<StateHandler>;
  reconnectTimeout: number | null;
  reconnectAttempts: number;
  intentionalClose: boolean;
}

const state: SignalingState = {
  ws: null,
  peerId: null,
  connectedPeers: new Set(),
  messageHandlers: new Set(),
  stateHandlers: new Set(),
  reconnectTimeout: null,
  reconnectAttempts: 0,
  intentionalClose: false,
};

const WS_URL = import.meta.env.DEV
  ? "ws://localhost:8787"
  : (import.meta.env.VITE_API_URL?.replace(/^http/, "ws") || `wss://${window.location.host}`);

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];

function notifyStateChange() {
  const connected = state.ws?.readyState === WebSocket.OPEN && state.peerId !== null;
  for (const handler of state.stateHandlers) {
    handler(connected, state.peerId, state.connectedPeers.size);
  }
}

function handleMessage(event: MessageEvent) {
  let data: unknown;
  try {
    data = JSON.parse(event.data as string);
  } catch {
    return;
  }

  const msg = data as { type: string; peerId?: string; peers?: string[]; from?: string };

  if (msg.type === "welcome") {
    console.log(`[SignalingSocket] Welcome! I am ${msg.peerId}, peers: ${msg.peers?.length || 0}`);
    state.peerId = msg.peerId || null;
    state.connectedPeers = new Set(msg.peers || []);
    state.reconnectAttempts = 0;
    notifyStateChange();
  } else if (msg.type === "peer-joined" && msg.peerId) {
    console.log(`[SignalingSocket] Peer joined: ${msg.peerId}`);
    state.connectedPeers.add(msg.peerId);
    notifyStateChange();
  } else if (msg.type === "peer-left" && msg.peerId) {
    console.log(`[SignalingSocket] Peer left: ${msg.peerId}`);
    state.connectedPeers.delete(msg.peerId);
    notifyStateChange();
  }

  // Forward all messages to handlers
  for (const handler of state.messageHandlers) {
    handler(data);
  }
}

function scheduleReconnect() {
  if (state.intentionalClose || state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    return;
  }

  const delay = RECONNECT_DELAYS[Math.min(state.reconnectAttempts, RECONNECT_DELAYS.length - 1)];
  console.log(`[SignalingSocket] Reconnecting in ${delay}ms (attempt ${state.reconnectAttempts + 1})`);

  state.reconnectTimeout = window.setTimeout(() => {
    state.reconnectAttempts++;
    connect(state.peerId ? `spinner` : "spinner"); // Use same room
  }, delay);
}

export function connect(roomId: string = "spinner"): void {
  // Already connected or connecting
  if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  // Clear any pending reconnect
  if (state.reconnectTimeout) {
    clearTimeout(state.reconnectTimeout);
    state.reconnectTimeout = null;
  }

  state.intentionalClose = false;

  console.log(`[SignalingSocket] Connecting to ${WS_URL}/api/signal/ws?roomId=${roomId}`);
  const ws = new WebSocket(`${WS_URL}/api/signal/ws?roomId=${encodeURIComponent(roomId)}`);
  state.ws = ws;

  ws.onopen = () => {
    console.log("[SignalingSocket] Connected");
  };

  ws.onmessage = handleMessage;

  ws.onclose = (event) => {
    console.log(`[SignalingSocket] Closed: code=${event.code}, reason=${event.reason}`);

    // Only handle if this is still our current WebSocket
    if (state.ws !== ws) return;

    state.ws = null;
    state.peerId = null;
    state.connectedPeers.clear();
    notifyStateChange();

    if (!state.intentionalClose) {
      scheduleReconnect();
    }
  };

  ws.onerror = (event) => {
    console.error("[SignalingSocket] Error:", event);
  };
}

export function disconnect(): void {
  state.intentionalClose = true;

  if (state.reconnectTimeout) {
    clearTimeout(state.reconnectTimeout);
    state.reconnectTimeout = null;
  }

  if (state.ws) {
    state.ws.close();
    state.ws = null;
  }

  state.peerId = null;
  state.connectedPeers.clear();
  notifyStateChange();
}

export function send(data: unknown): boolean {
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(data));
    return true;
  }
  return false;
}

export function sendTo(to: string, type: string, payload: Record<string, unknown>): boolean {
  return send({ type, to, ...payload });
}

export function onMessage(handler: MessageHandler): () => void {
  state.messageHandlers.add(handler);
  return () => state.messageHandlers.delete(handler);
}

export function onStateChange(handler: StateHandler): () => void {
  state.stateHandlers.add(handler);
  // Immediately call with current state
  const connected = state.ws?.readyState === WebSocket.OPEN && state.peerId !== null;
  handler(connected, state.peerId, state.connectedPeers.size);
  return () => state.stateHandlers.delete(handler);
}

export function getState() {
  return {
    connected: state.ws?.readyState === WebSocket.OPEN && state.peerId !== null,
    peerId: state.peerId,
    peerCount: state.connectedPeers.size,
    peers: [...state.connectedPeers],
  };
}

// Don't auto-connect - let components control this
// if (typeof window !== "undefined") {
//   connect("spinner");
// }
