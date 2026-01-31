import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, type TRPCContext } from "@arnott/api";

// Re-export the Durable Object
export { SpinnerRoom } from "./durable-objects/spinner-room.js";

interface Env {
  SPINNER_ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
}

/**
 * Create tRPC context for each request
 */
function createContext(): TRPCContext {
  return {};
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket connections for spinner sync
    if (url.pathname.startsWith("/api/spinner/")) {
      const roomId = url.pathname.split("/")[3] || "default";
      const durableObjectId = env.SPINNER_ROOM.idFromName(roomId);
      const stub = env.SPINNER_ROOM.get(durableObjectId);

      // Forward to Durable Object
      const doUrl = new URL(request.url);
      doUrl.pathname = "/websocket";
      return stub.fetch(new Request(doUrl, request));
    }

    // Handle spinner room info
    if (url.pathname.startsWith("/api/spinner-info/")) {
      const roomId = url.pathname.split("/")[3] || "default";
      const durableObjectId = env.SPINNER_ROOM.idFromName(roomId);
      const stub = env.SPINNER_ROOM.get(durableObjectId);

      const doUrl = new URL(request.url);
      doUrl.pathname = "/info";
      return stub.fetch(new Request(doUrl, request));
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

    // Serve static assets for everything else
    return env.ASSETS.fetch(request);
  },
};
