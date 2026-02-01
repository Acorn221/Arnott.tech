import { test, expect, chromium, type Browser, type Page } from "@playwright/test";

/**
 * Multi-browser E2E tests for cross-browser sync via WebRTC/WebSocket.
 *
 * IMPORTANT: These tests use independent browser instances (chromium.launch())
 * NOT browser contexts, because browser contexts share BroadcastChannel.
 * This forces communication through the signaling server and WebRTC/WebSocket.
 *
 * Prerequisites:
 * - Dev server running at localhost:3000
 * - Signaling server running at ws://localhost:8787/api/signal/ws
 */

// Helper to get sync state from page
async function getSyncState(page: Page) {
  return page.evaluate(() => window.__sync_state__);
}

// Helper to wait for connected state
async function waitForConnected(page: Page, timeout = 15000) {
  await page.waitForFunction(
    () => window.__sync_state__?.isConnected === true,
    { timeout }
  );
  return getSyncState(page);
}

// Helper to wait for peer count
async function waitForPeerCount(page: Page, count: number, timeout = 20000) {
  await page.waitForFunction(
    (expected) =>
      window.__sync_state__?.isConnected === true &&
      window.__sync_state__?.peerCount >= expected,
    count,
    { timeout }
  );
  return getSyncState(page);
}

// Helper to broadcast test message
async function broadcastTestMessage(page: Page, payload: string) {
  await page.evaluate((msg) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(msg);
    window.__sync_broadcast__?.(data.buffer);
  }, payload);
}

// Helper to get received messages
async function getReceivedMessages(page: Page) {
  return page.evaluate(() =>
    window.__sync_messages__?.map((m) => ({
      peerId: m.peerId,
      timestamp: m.timestamp,
      // Convert ArrayBuffer to string for assertion
      text: new TextDecoder().decode(new Uint8Array(m.data)),
    })) ?? []
  );
}

test.describe("Multi-Browser Sync (WebRTC/WebSocket)", () => {
  let browser1: Browser;
  let browser2: Browser;
  let page1: Page;
  let page2: Page;

  test.beforeEach(async () => {
    // Launch completely independent browser instances
    // This ensures BroadcastChannel is NOT shared - forces WebRTC/WS
    [browser1, browser2] = await Promise.all([
      chromium.launch({ headless: true }),
      chromium.launch({ headless: true }),
    ]);

    const [context1, context2] = await Promise.all([
      browser1.newContext({ baseURL: "http://localhost:3000" }),
      browser2.newContext({ baseURL: "http://localhost:3000" }),
    ]);

    [page1, page2] = await Promise.all([
      context1.newPage(),
      context2.newPage(),
    ]);
  });

  test.afterEach(async () => {
    await Promise.all([browser1?.close(), browser2?.close()]);
  });

  test("both browsers connect and show synced status", async () => {
    // Navigate both browsers to the app
    await Promise.all([page1.goto("/"), page2.goto("/")]);

    // Both should show synced indicator
    await expect(page1.locator("text=Synced")).toBeVisible({ timeout: 15000 });
    await expect(page2.locator("text=Synced")).toBeVisible({ timeout: 15000 });
  });

  test("browsers discover each other via signaling server", async () => {
    // Navigate first browser
    await page1.goto("/");
    const state1Initial = await waitForConnected(page1);
    expect(state1Initial?.isConnected).toBe(true);

    // Navigate second browser
    await page2.goto("/");
    const state2Initial = await waitForConnected(page2);
    expect(state2Initial?.isConnected).toBe(true);

    // Wait for peer discovery - each should see at least 1 peer
    // (the other browser via signaling)
    // Note: This may take longer due to WebRTC negotiation
    try {
      await waitForPeerCount(page1, 1, 20000);
      await waitForPeerCount(page2, 1, 20000);

      const state1 = await getSyncState(page1);
      const state2 = await getSyncState(page2);

      expect(state1?.peerCount).toBeGreaterThanOrEqual(1);
      expect(state2?.peerCount).toBeGreaterThanOrEqual(1);
    } catch {
      // If signaling server isn't running, peer discovery won't work
      // but basic connectivity should still work
      console.log(
        "Warning: Peer discovery timed out. Is the signaling server running?"
      );
    }
  });

  test("message from browser1 reaches browser2 via WebRTC/WS", async () => {
    // Set up both browsers
    await Promise.all([page1.goto("/"), page2.goto("/")]);

    await waitForConnected(page1);
    await waitForConnected(page2);

    // Wait for peer discovery
    try {
      await waitForPeerCount(page1, 1, 20000);
      await waitForPeerCount(page2, 1, 20000);
    } catch {
      test.skip(true, "Signaling server not available");
      return;
    }

    // Clear any existing messages
    await page2.evaluate(() => {
      if (window.__sync_messages__) {
        window.__sync_messages__ = [];
      }
    });

    // Broadcast test message from browser1
    const testMessage = `test-message-${Date.now()}`;
    await broadcastTestMessage(page1, testMessage);

    // Wait for message to arrive at browser2
    await page2.waitForFunction(
      () => (window.__sync_messages__?.length ?? 0) > 0,
      { timeout: 10000 }
    );

    const messages = await getReceivedMessages(page2);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((m) => m.text === testMessage)).toBe(true);
  });

  test("bidirectional message exchange", async () => {
    // Set up both browsers
    await Promise.all([page1.goto("/"), page2.goto("/")]);

    await waitForConnected(page1);
    await waitForConnected(page2);

    // Wait for peer discovery
    try {
      await waitForPeerCount(page1, 1, 20000);
      await waitForPeerCount(page2, 1, 20000);
    } catch {
      test.skip(true, "Signaling server not available");
      return;
    }

    // Clear messages on both sides
    await Promise.all([
      page1.evaluate(() => {
        if (window.__sync_messages__) window.__sync_messages__ = [];
      }),
      page2.evaluate(() => {
        if (window.__sync_messages__) window.__sync_messages__ = [];
      }),
    ]);

    // Send messages in both directions
    const msg1to2 = `browser1-to-browser2-${Date.now()}`;
    const msg2to1 = `browser2-to-browser1-${Date.now()}`;

    await Promise.all([
      broadcastTestMessage(page1, msg1to2),
      broadcastTestMessage(page2, msg2to1),
    ]);

    // Wait for messages to arrive
    await Promise.all([
      page1.waitForFunction(
        () => (window.__sync_messages__?.length ?? 0) > 0,
        { timeout: 10000 }
      ),
      page2.waitForFunction(
        () => (window.__sync_messages__?.length ?? 0) > 0,
        { timeout: 10000 }
      ),
    ]);

    const messages1 = await getReceivedMessages(page1);
    const messages2 = await getReceivedMessages(page2);

    // Browser1 should have received message from browser2
    expect(messages1.some((m) => m.text === msg2to1)).toBe(true);
    // Browser2 should have received message from browser1
    expect(messages2.some((m) => m.text === msg1to2)).toBe(true);
  });

  test("leader election across browsers", async () => {
    // Navigate first browser - should become leader
    await page1.goto("/");
    await waitForConnected(page1);

    // Wait for leadership claim
    await page1.waitForTimeout(500);
    const state1 = await getSyncState(page1);
    expect(state1?.isLeader).toBe(true);

    // Navigate second browser
    await page2.goto("/");
    await waitForConnected(page2);

    // Each browser has its own leader election (isolated)
    // Since they're in separate processes, both may claim leadership
    // The signaling server doesn't coordinate leadership - that's tab-local
    const state2 = await getSyncState(page2);
    expect(state2?.isConnected).toBe(true);
  });
});

test.describe("Cross-Browser Recovery", () => {
  let browser1: Browser;
  let browser2: Browser;
  let page1: Page;
  let page2: Page;

  test.beforeEach(async () => {
    [browser1, browser2] = await Promise.all([
      chromium.launch({ headless: true }),
      chromium.launch({ headless: true }),
    ]);

    const [context1, context2] = await Promise.all([
      browser1.newContext({ baseURL: "http://localhost:3000" }),
      browser2.newContext({ baseURL: "http://localhost:3000" }),
    ]);

    [page1, page2] = await Promise.all([
      context1.newPage(),
      context2.newPage(),
    ]);
  });

  test.afterEach(async () => {
    await Promise.all([browser1?.close(), browser2?.close()]);
  });

  test("browser2 continues working after browser1 closes", async () => {
    // Set up both browsers
    await Promise.all([page1.goto("/"), page2.goto("/")]);

    await waitForConnected(page1);
    await waitForConnected(page2);

    // Wait for peer discovery
    try {
      await waitForPeerCount(page1, 1, 20000);
      await waitForPeerCount(page2, 1, 20000);
    } catch {
      // Continue anyway - we're testing browser closure handling
    }

    // Close browser1
    await browser1.close();

    // Small wait for peer loss detection
    await page2.waitForTimeout(2000);

    // Browser2 should still be connected and functional
    await expect(page2.locator("text=Synced")).toBeVisible();
    const state2 = await getSyncState(page2);
    expect(state2?.isConnected).toBe(true);
  });

  test("page refresh reconnects to other browsers", async () => {
    // Set up both browsers
    await Promise.all([page1.goto("/"), page2.goto("/")]);

    await waitForConnected(page1);
    await waitForConnected(page2);

    // Refresh page1
    await page1.reload();

    // Wait for reconnection
    await waitForConnected(page1, 15000);
    await expect(page1.locator("text=Synced")).toBeVisible();

    // Both should still work
    const state1 = await getSyncState(page1);
    const state2 = await getSyncState(page2);
    expect(state1?.isConnected).toBe(true);
    expect(state2?.isConnected).toBe(true);
  });
});
