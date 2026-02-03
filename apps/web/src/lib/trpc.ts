import type { AppRouter } from "@arnott/api";
import { QueryClient } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

/**
 * tRPC React client hooks
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Create the tRPC client
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
      }),
    ],
  });
}

/**
 * Create a React Query client
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  });
}

/**
 * Get the WebSocket URL for spinner sync
 */
export function getSpinnerWebSocketUrl(roomId = "default"): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/spinner/${roomId}`;
}
