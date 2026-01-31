import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, type TRPCContext } from "@arnott/api";

// Export Durable Object class for Cloudflare
export { SignalingRoom } from "./SignalingRoom";

interface Env {
  SIGNALING_ROOM: DurableObjectNamespace;
  ASSETS?: Fetcher; // Only available in production
}

/**
 * Create tRPC context for each request
 */
function createContext(): TRPCContext {
  return {};
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket signaling via Durable Object
    if (url.pathname === "/api/signal/ws") {
      const roomId = url.searchParams.get("roomId") || "default";
      const id = env.SIGNALING_ROOM.idFromName(roomId);
      return env.SIGNALING_ROOM.get(id).fetch(request);
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
