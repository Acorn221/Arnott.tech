/**
 * Multi-browser test utilities for E2E sync testing.
 *
 * Key insight: Browser contexts within the same browser process share BroadcastChannel.
 * For true multi-browser testing (WebRTC/WebSocket only), we need independent browser instances.
 */

import { chromium, type Browser, type Page } from "@playwright/test";

/** Sync test state exposed by the app */
export interface SyncTestState {
  isConnected: boolean;
  peerCount: number;
  isLeader: boolean;
  localId: string;
}

/** Message stored by test instrumentation */
export interface SyncTestMessage {
  peerId: string;
  data: ArrayBuffer;
  timeOffset: number;
  timestamp: number;
}

/** Options for launching a test browser */
export interface LaunchBrowserOptions {
  headless?: boolean;
  slowMo?: number;
  baseURL?: string;
}

/** Handle to a test browser instance */
export interface TestBrowser {
  browser: Browser;
  page: Page;
  close: () => Promise<void>;
}

/**
 * Launch an independent browser instance.
 * Unlike browser.newContext(), each instance is a separate process
 * so BroadcastChannel is NOT shared.
 */
export async function launchTestBrowser(
  options: LaunchBrowserOptions = {}
): Promise<TestBrowser> {
  const { headless = true, slowMo = 0, baseURL = "http://localhost:3000" } = options;

  const browser = await chromium.launch({ headless, slowMo });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  return {
    browser,
    page,
    close: async () => {
      await browser.close();
    },
  };
}

/**
 * Wait for the sync system to report connected state.
 */
export async function waitForConnected(
  page: Page,
  timeout = 10000
): Promise<SyncTestState> {
  await page.waitForFunction(
    () => window.__sync_state__?.isConnected === true,
    { timeout }
  );

  const state = await page.evaluate(() => window.__sync_state__);
  if (!state) {
    throw new Error("Sync state not available");
  }
  return state;
}

/**
 * Wait for a specific number of peers to be connected.
 * Queries coordinator directly for live peer count.
 */
export async function waitForPeerCount(
  page: Page,
  count: number,
  timeout = 15000
): Promise<SyncTestState> {
  await page.waitForFunction(
    (expected) => {
      const coordinator = window.__sync_coordinator__;
      if (!coordinator) return false;
      return coordinator.isConnected && coordinator.peerCount >= expected;
    },
    count,
    { timeout }
  );

  const state = await page.evaluate(() => {
    const coordinator = window.__sync_coordinator__;
    if (!coordinator) return window.__sync_state__;
    return {
      isConnected: coordinator.isConnected,
      peerCount: coordinator.peerCount,
      isLeader: coordinator.isLeader,
      localId: coordinator.getLocalId(),
    };
  });
  if (!state) {
    throw new Error("Sync state not available");
  }
  return state;
}

/**
 * Wait for this tab to become leader.
 */
export async function waitForLeader(
  page: Page,
  timeout = 10000
): Promise<SyncTestState> {
  await page.waitForFunction(
    () =>
      window.__sync_state__?.isConnected === true &&
      window.__sync_state__?.isLeader === true,
    { timeout }
  );

  const state = await page.evaluate(() => window.__sync_state__);
  if (!state) {
    throw new Error("Sync state not available");
  }
  return state;
}

/**
 * Wait for a message to be received.
 * Returns the first message matching the predicate, or throws on timeout.
 */
export async function waitForMessage(
  page: Page,
  predicate: (msg: { peerId: string; timestamp: number }) => boolean,
  timeout = 10000
): Promise<{ peerId: string; timestamp: number }> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const messages = await page.evaluate(() =>
      window.__sync_messages__?.map((m) => ({
        peerId: m.peerId,
        timestamp: m.timestamp,
      }))
    );

    if (messages) {
      const match = messages.find(predicate);
      if (match) {
        return match;
      }
    }

    await page.waitForTimeout(100);
  }

  throw new Error("Timeout waiting for message");
}

/**
 * Get the current sync state.
 */
export async function getSyncState(page: Page): Promise<SyncTestState | null> {
  return page.evaluate(() => window.__sync_state__ ?? null);
}

/**
 * Get all received messages.
 */
export async function getReceivedMessages(
  page: Page
): Promise<Array<{ peerId: string; timestamp: number }>> {
  const messages = await page.evaluate(() =>
    window.__sync_messages__?.map((m) => ({
      peerId: m.peerId,
      timestamp: m.timestamp,
    }))
  );
  return messages ?? [];
}

/**
 * Broadcast a test message from the page.
 */
export async function broadcastTestMessage(
  page: Page,
  payload: string
): Promise<void> {
  await page.evaluate((msg) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(msg);
    window.__sync_broadcast__?.(data.buffer);
  }, payload);
}

/**
 * Clear received messages.
 */
export async function clearMessages(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (window.__sync_messages__) {
      window.__sync_messages__ = [];
    }
  });
}

/**
 * Wait for the page to load and sync to connect.
 */
export async function navigateAndConnect(
  page: Page,
  path = "/",
  timeout = 15000
): Promise<SyncTestState> {
  await page.goto(path);
  return waitForConnected(page, timeout);
}

/**
 * Coordination helper - ensure all browsers are connected before proceeding.
 */
export async function waitForAllConnected(
  pages: Page[],
  timeout = 15000
): Promise<SyncTestState[]> {
  return Promise.all(pages.map((page) => waitForConnected(page, timeout)));
}

/**
 * Debug helper - log sync state from all pages.
 */
export async function logSyncStates(
  pages: Page[],
  label = "Sync states"
): Promise<void> {
  const states = await Promise.all(pages.map((p) => getSyncState(p)));
  console.log(`${label}:`, JSON.stringify(states, null, 2));
}
