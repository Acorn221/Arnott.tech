import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, type TRPCContext } from "@arnott/api";

interface Env {
  SPINNER_KV: KVNamespace;
  ASSETS?: Fetcher; // Only available in production
}

interface Peer {
  id: string;
  joinedAt: number;
}

interface IceCandidate {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

interface Signal {
  type: "offer" | "answer" | "ice";
  from: string;
  sdp?: string;
  candidate?: IceCandidate;
}

interface JoinRequest {
  roomId?: string;
}

interface LeaveRequest {
  roomId?: string;
  peerId: string;
}

interface SdpRequest {
  from: string;
  to: string;
  sdp: string;
}

interface IceRequest {
  from: string;
  to: string;
  candidate: IceCandidate;
}

/**
 * Create tRPC context for each request
 */
function createContext(): TRPCContext {
  return {};
}

/**
 * Generate a random peer ID
 */
function generatePeerId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Get peers in a room
 */
async function getRoomPeers(kv: KVNamespace, roomId: string): Promise<Peer[]> {
  const key = `room:${roomId}:peers`;
  const data = await kv.get(key);
  return data ? JSON.parse(data) : [];
}

/**
 * Save peers to a room
 */
async function saveRoomPeers(
  kv: KVNamespace,
  roomId: string,
  peers: Peer[],
): Promise<void> {
  const key = `room:${roomId}:peers`;
  await kv.put(key, JSON.stringify(peers));
}

/**
 * Handle signaling API routes
 */
async function handleSignaling(
  request: Request,
  env: Env,
  pathname: string,
): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // POST /api/signal/join - Join a room
    if (pathname === "/api/signal/join" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as JoinRequest;
      const roomId = body.roomId ?? "default";
      const peerId = generatePeerId();
      const peers = await getRoomPeers(env.SPINNER_KV, roomId);

      // Remove stale peers (older than 5 minutes)
      const now = Date.now();
      const activePeers = peers.filter((p) => now - p.joinedAt < 5 * 60 * 1000);

      // Add new peer
      activePeers.push({ id: peerId, joinedAt: now });
      await saveRoomPeers(env.SPINNER_KV, roomId, activePeers);

      // Return peer ID and list of other peers
      const otherPeers = activePeers.filter((p) => p.id !== peerId);
      return new Response(
        JSON.stringify({ peerId, peers: otherPeers.map((p) => p.id) }),
        { headers: corsHeaders },
      );
    }

    // POST /api/signal/leave - Leave a room
    if (pathname === "/api/signal/leave" && request.method === "POST") {
      const body = (await request.json()) as LeaveRequest;
      const roomId = body.roomId ?? "default";
      const peerId = body.peerId;
      if (!peerId) {
        return new Response(JSON.stringify({ error: "peerId required" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const peers = await getRoomPeers(env.SPINNER_KV, roomId);
      const filtered = peers.filter((p) => p.id !== peerId);
      await saveRoomPeers(env.SPINNER_KV, roomId, filtered);

      return new Response(JSON.stringify({ success: true }), {
        headers: corsHeaders,
      });
    }

    // POST /api/signal/offer - Store SDP offer
    if (pathname === "/api/signal/offer" && request.method === "POST") {
      const { from, to, sdp } = (await request.json()) as SdpRequest;
      if (!from || !to || !sdp) {
        return new Response(
          JSON.stringify({ error: "from, to, sdp required" }),
          { status: 400, headers: corsHeaders },
        );
      }

      const signal: Signal = { type: "offer", from, sdp };
      await env.SPINNER_KV.put(`signal:${to}:${from}:offer`, JSON.stringify(signal), {
        expirationTtl: 60,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: corsHeaders,
      });
    }

    // POST /api/signal/answer - Store SDP answer
    if (pathname === "/api/signal/answer" && request.method === "POST") {
      const { from, to, sdp } = (await request.json()) as SdpRequest;
      if (!from || !to || !sdp) {
        return new Response(
          JSON.stringify({ error: "from, to, sdp required" }),
          { status: 400, headers: corsHeaders },
        );
      }

      const signal: Signal = { type: "answer", from, sdp };
      await env.SPINNER_KV.put(`signal:${to}:${from}:answer`, JSON.stringify(signal), {
        expirationTtl: 60,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: corsHeaders,
      });
    }

    // POST /api/signal/ice - Store ICE candidate
    if (pathname === "/api/signal/ice" && request.method === "POST") {
      const { from, to, candidate } = (await request.json()) as IceRequest;
      if (!from || !to || !candidate) {
        return new Response(
          JSON.stringify({ error: "from, to, candidate required" }),
          { status: 400, headers: corsHeaders },
        );
      }

      // ICE candidates need unique keys - use UUID to prevent collisions
      const uuid = crypto.randomUUID();
      const key = `signal:${to}:${from}:ice:${uuid}`;
      const signal: Signal = { type: "ice", from, candidate };
      await env.SPINNER_KV.put(key, JSON.stringify(signal), {
        expirationTtl: 60,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: corsHeaders,
      });
    }

    // GET /api/signal/poll/:peerId - Get pending signals
    if (pathname.startsWith("/api/signal/poll/") && request.method === "GET") {
      const peerId = pathname.split("/")[4];
      if (!peerId) {
        return new Response(JSON.stringify({ error: "peerId required" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // List all signals for this peer
      const list = await env.SPINNER_KV.list({ prefix: `signal:${peerId}:` });
      const signals: Signal[] = [];

      for (const key of list.keys) {
        const data = await env.SPINNER_KV.get(key.name);
        if (data) {
          signals.push(JSON.parse(data));
          // Delete after reading
          await env.SPINNER_KV.delete(key.name);
        }
      }

      return new Response(JSON.stringify({ signals }), {
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Signaling error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders },
    );
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle signaling API
    if (url.pathname.startsWith("/api/signal")) {
      return handleSignaling(request, env, url.pathname);
    }

    // Handle tRPC requests
    if (url.pathname.startsWith("/api/trpc")) {
      return fetchRequestHandler({
        endpoint: "/api/trpc",
        req: request,
        router: appRouter,
        createContext,
      });
    }

    // Serve static assets for everything else (only in production)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // In local dev, return 404 for non-API routes (Vite serves the frontend)
    return new Response("Not found", { status: 404 });
  },
};
