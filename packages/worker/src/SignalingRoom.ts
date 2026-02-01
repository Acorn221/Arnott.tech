import { DurableObject } from "cloudflare:workers";

interface WebSocketMeta {
  peerId: string;
  roomId: string;
}

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
    server.send(JSON.stringify({
      type: "welcome",
      peerId,
      peers: existingPeers,
    }));

    // Notify existing peers
    this.broadcast({ type: "peer-joined", peerId }, peerId);

    return new Response(null, { status: 101, webSocket: client });
  }

  private handleMessage(fromPeerId: string, data: string | ArrayBuffer): void {
    // Binary = spinner data, broadcast to all other peers
    // Use typeof check for robustness (instanceof can fail across realms)
    if (typeof data !== "string") {
      console.log(`[SignalingRoom] Relaying binary from ${fromPeerId} to ${this.sessions.size - 1} peers`);
      for (const [peerId, session] of this.sessions) {
        if (peerId !== fromPeerId) {
          try {
            session.ws.send(data);
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
