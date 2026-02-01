/**
 * Global type declarations for E2E tests.
 * These extend the Window interface for test instrumentation.
 */

interface SyncTestState {
  isConnected: boolean;
  peerCount: number;
  isLeader: boolean;
  localId: string;
}

interface SyncTestMessage {
  peerId: string;
  data: ArrayBuffer;
  timeOffset: number;
  timestamp: number;
}

declare global {
  interface Window {
    __sync_state__?: SyncTestState;
    __sync_messages__?: SyncTestMessage[];
    __sync_broadcast__?: (data: ArrayBuffer) => void;
  }
}

export {};
