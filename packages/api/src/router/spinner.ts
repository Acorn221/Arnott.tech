import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import type { SpinnerRoomInfo } from "@arnott/shared";

/**
 * Spinner router for HTTP-based operations
 * Note: Real-time sync happens over WebSocket via Durable Objects
 */
export const spinnerRouter = router({
  /**
   * Get info about the spinner room
   * This is a placeholder - actual data would come from Durable Object
   */
  getRoomInfo: publicProcedure
    .input(z.object({ roomId: z.string().optional().default("default") }))
    .query(async ({ input }): Promise<SpinnerRoomInfo> => {
      // In production, this would fetch from the Durable Object
      // For now, return placeholder data
      return {
        connectedUsers: 0,
        totalSpins: 0,
      };
    }),

  /**
   * Increment the global spin count
   * This persists the spin count when users disconnect
   */
  recordSpins: publicProcedure
    .input(
      z.object({
        roomId: z.string().optional().default("default"),
        spinCount: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input }) => {
      // In production, this would update D1 or Durable Object storage
      // For now, just acknowledge the request
      return { success: true, recorded: input.spinCount };
    }),
});
