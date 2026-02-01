import { DurableObject } from "cloudflare:workers";

interface IceCandidate {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

interface Signal {
  type: "offer" | "answer" | "ice";
  to: string;
  from?: string;
  sdp?: string;
  candidate?: IceCandidate;
}

interface Env {
  SIGNALING_ROOM: DurableObjectNamespace;
}

/**
 * SignalingRoom Durable Object
 * Using standard WebSocket API (not hibernation) for local dev compatibility.
 */
export class SignalingRoom extends DurableObject<Env> {
  private sessions: Map<string, { ws: WebSocket; peerId: string }> = new Map();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Only handle WebSocket upgrades
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 400 });
    }

    const roomId = url.searchParams.get("roomId") || "default";
    const peerId = crypto.randomUUID().slice(0, 8);

    // Get existing peer list BEFORE adding new peer
    const existingPeers = [...this.sessions.keys()];

    console.log(`[SignalingRoom] New connection: roomId=${roomId}, peerId=${peerId}, existingPeers=[${existingPeers.join(", ")}]`);

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket (standard API, not hibernation)
    server.accept();

    // Track session
    this.sessions.set(peerId, { ws: server, peerId });

    // New peer connected

    // Set up message handler
    server.addEventListener("message", (event) => {
      this.handleMessage(peerId, event.data as string | ArrayBuffer);
    });

    // Set up close handler
    server.addEventListener("close", () => {
      this.sessions.delete(peerId);
      this.broadcast({ type: "peer-left", peerId }, peerId);
    });

    // Set up error handler
    server.addEventListener("error", () => {
      this.sessions.delete(peerId);
    });

    // Send welcome message
    const welcomeMsg = { type: "welcome", peerId, peers: existingPeers };
    console.log(`[SignalingRoom] Sending welcome:`, JSON.stringify(welcomeMsg));
    server.send(JSON.stringify(welcomeMsg));

    // Notify existing peers
    console.log(`[SignalingRoom] Broadcasting peer-joined to ${this.sessions.size - 1} peers`);
    this.broadcast({ type: "peer-joined", peerId }, peerId);

    return new Response(null, { status: 101, webSocket: client });
  }

  private handleMessage(fromPeerId: string, data: string | ArrayBuffer): void {
    // Binary = spinner data, broadcast to all other peers
    // Use typeof check for robustness (instanceof can fail across realms)
    if (typeof data !== "string") {
      // Wrap binary with 8-byte sender ID header so clients know who sent it
      const payload = data instanceof ArrayBuffer ? new Uint8Array(data) : new TextEncoder().encode(String(data));
      const header = new TextEncoder().encode(fromPeerId.padEnd(8, '\0'));
      const wrapped = new Uint8Array(8 + payload.byteLength);
      wrapped.set(header, 0);
      wrapped.set(payload, 8);

      for (const [peerId, session] of this.sessions) {
        if (peerId !== fromPeerId) {
          try {
            session.ws.send(wrapped.buffer);
          } catch (e) {
            console.error(`[SignalingRoom] Failed to relay to ${peerId}:`, e);
          }
        }
      }
      return;
    }

    // JSON = signaling, route to specific peer
    let msg: Signal | { type: string };
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    // Relay signaling messages
    if (msg.type === "offer" || msg.type === "answer" || msg.type === "ice") {
      const signal = msg as Signal;
      const target = this.sessions.get(signal.to);

      if (target) {
        target.ws.send(JSON.stringify({
          type: signal.type,
          from: fromPeerId,
          sdp: signal.sdp,
          candidate: signal.candidate,
        }));
      }
    }

    // Targeted WebSocket relay (for sendTo fallback when WebRTC unavailable)
    if (msg.type === "relay-to") {
      const { to, payload } = msg as { type: string; to: string; payload: string };
      const target = this.sessions.get(to);
      if (target) {
        // Decode base64 payload and wrap with sender ID header
        const payloadBytes = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
        const header = new TextEncoder().encode(fromPeerId.padEnd(8, '\0'));
        const wrapped = new Uint8Array(8 + payloadBytes.length);
        wrapped.set(header, 0);
        wrapped.set(payloadBytes, 8);
        target.ws.send(wrapped.buffer);
      }
    }
  }

  private broadcast(msg: unknown, excludePeerId: string): void {
    const json = JSON.stringify(msg);
    for (const [peerId, session] of this.sessions) {
      if (peerId !== excludePeerId) {
        try {
          session.ws.send(json);
        } catch {
          // Ignore send errors
        }
      }
    }
  }
}
