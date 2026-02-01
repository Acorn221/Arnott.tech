import { initTRPC } from "@trpc/server";
import superjson from "superjson";

/**
 * Context for tRPC procedures
 * This can be extended later to include:
 * - Database connection (D1)
 * - Auth info
 * - Request info
 */
export interface TRPCContext {
  // Placeholder for future context
}

/**
 * Initialize tRPC with superjson transformer
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

/**
 * Export reusable router and procedure helpers
 */
export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
