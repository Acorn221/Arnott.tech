import { router } from "../trpc.js";
import { spinnerRouter } from "./spinner.js";

/**
 * Root router for all tRPC procedures
 */
export const appRouter = router({
  spinner: spinnerRouter,
});

/**
 * Export type definition of the API
 */
export type AppRouter = typeof appRouter;
