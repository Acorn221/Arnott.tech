import { useContext } from "react";
import { SyncContext } from "./SyncProvider";
import type { SyncContextValue } from "./types";

/**
 * Hook to access the sync context.
 * Must be used within a SyncProvider.
 */
export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
}

/**
 * Hook to optionally access the sync context.
 * Returns null if not within a SyncProvider.
 */
export function useSyncOptional(): SyncContextValue | null {
  return useContext(SyncContext);
}
