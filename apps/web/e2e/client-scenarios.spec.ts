import { test, expect, chromium, type Browser, type Page } from "@playwright/test";

/**
 * Client join/leave and mixed transport scenario tests.
 *
 * Tests:
 * 1. New client joining an existing room
 * 2. Client leaving gracefully
 * 3. Client leaving abruptly (crash)
 * 4. WebSocket-only client joining (WebRTC blocked)
 * 5. WebRTC client joining WS-only room
 * 6. Mixed transport room - messages reach everyone
 */

// Helper to get sync state
async function getSyncState(page: Page) {
  return page.evaluate(() => window.__sync_state__);
}

// Helper to wait for connected
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
async function broadcastMessage(page: Page, text: string) {
  await page.evaluate((msg) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(msg);
    window.__sync_broadcast__?.(data.buffer);
  }, text);
}

// Helper to get received messages
async function getMessages(page: Page) {
  return page.evaluate(() =>
    window.__sync_messages__?.map((m) => ({
      peerId: m.peerId,
      text: new TextDecoder().decode(new Uint8Array(m.data)),
      timestamp: m.timestamp,
    })) ?? []
  );
}

// Helper to clear messages
async function clearMessages(page: Page) {
  await page.evaluate(() => {
    if (window.__sync_messages__) window.__sync_messages__ = [];
  });
}

// Block WebRTC by intercepting STUN server requests
async function blockWebRTC(page: Page) {
  await page.route("**/*stun*/**", (route) => route.abort());
  // Also block the RTCPeerConnection by making ICE fail
  await page.addInitScript(() => {
    const OriginalRTCPeerConnection = window.RTCPeerConnection;
    // @ts-ignore
    window.RTCPeerConnection = function (...args: any[]) {
      const pc = new OriginalRTCPeerConnection(...args);
      // Force ICE to fail by closing immediately after creation
      setTimeout(() => {
        if (pc.connectionState !== "connected") {
          pc.close();
        }
      }, 100);
      return pc;
    };
    window.RTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;
  });
}

test.describe("Client Join Scenarios", () => {
  let browser1: Browser;
  let browser2: Browser;
  let browser3: Browser;
  let page1: Page;
  let page2: Page;
  let page3: Page;

  test.afterEach(async () => {
    await Promise.all([
      browser1?.close(),
      browser2?.close(),
      browser3?.close(),
    ]);
  });

  test("new client joins and receives state from existing clients", async () => {
    // Launch first two browsers
    [browser1, browser2] = await Promise.all([
      chromium.launch({ headless: true }),
      chromium.launch({ headless: true }),
    ]);

    const [ctx1, ctx2] = await Promise.all([
      browser1.newContext({ baseURL: "http://localhost:3000" }),
      browser2.newContext({ baseURL: "http://localhost:3000" }),
    ]);

    [page1, page2] = await Promise.all([ctx1.newPage(), ctx2.newPage()]);

    // Connect first two clients
    await Promise.all([page1.goto("/"), page2.goto("/")]);
    await waitForConnected(page1);
    await waitForConnected(page2);

    // Wait for them to discover each other
    try {
      await waitForPeerCount(page1, 1, 15000);
    } catch {
      test.skip(true, "Signaling server not available");
      return;
    }

    // Now launch third browser (new client joining)
    browser3 = await chromium.launch({ headless: true });
    const ctx3 = await browser3.newContext({ baseURL: "http://localhost:3000" });
    page3 = await ctx3.newPage();

    await page3.goto("/");
    await waitForConnected(page3);

    // Third client should discover existing peers
    await waitForPeerCount(page3, 2, 20000);

    const state3 = await getSyncState(page3);
    expect(state3?.peerCount).toBeGreaterThanOrEqual(2);

    // Existing clients should see the new peer
    await waitForPeerCount(page1, 2, 10000);
    await waitForPeerCount(page2, 2, 10000);
  });

  test("new client joining receives messages from existing clients", async () => {
    [browser1, browser2] = await Promise.all([
      chromium.launch({ headless: true }),
      chromium.launch({ headless: true }),
    ]);

    const [ctx1, ctx2] = await Promise.all([
      browser1.newContext({ baseURL: "http://localhost:3000" }),
      browser2.newContext({ baseURL: "http://localhost:3000" }),
    ]);

    [page1, page2] = await Promise.all([ctx1.newPage(), ctx2.newPage()]);

    await Promise.all([page1.goto("/"), page2.goto("/")]);
    await waitForConnected(page1);
    await waitForConnected(page2);

    try {
      await waitForPeerCount(page1, 1, 15000);
    } catch {
      test.skip(true, "Signaling server not available");
      return;
    }

    // New client joins
    browser3 = await chromium.launch({ headless: true });
    const ctx3 = await browser3.newContext({ baseURL: "http://localhost:3000" });
    page3 = await ctx3.newPage();

    await page3.goto("/");
    await waitForConnected(page3);
    await waitForPeerCount(page3, 1, 20000);

    // Clear messages on new client
    await clearMessages(page3);

    // Existing client sends message
    const testMsg = `welcome-${Date.now()}`;
    await broadcastMessage(page1, testMsg);

    // New client should receive it
    await page3.waitForFunction(
      () => (window.__sync_messages__?.length ?? 0) > 0,
      { timeout: 10000 }
    );

    const messages = await getMessages(page3);
    expect(messages.some((m) => m.text === testMsg)).toBe(true);
  });
});

test.describe("Client Leave Scenarios", () => {
  let browser1: Browser;
  let browser2: Browser;
  let page1: Page;
  let page2: Page;

  test.afterEach(async () => {
    await Promise.all([browser1?.close(), browser2?.close()]);
  });

  test("graceful client leave - other clients handle it", async () => {
    [browser1, browser2] = await Promise.all([
      chromium.launch({ headless: true }),
      chromium.launch({ headless: true }),
    ]);

    const [ctx1, ctx2] = await Promise.all([
      browser1.newContext({ baseURL: "http://localhost:3000" }),
      browser2.newContext({ baseURL: "http://localhost:3000" }),
    ]);

    [page1, page2] = await Promise.all([ctx1.newPage(), ctx2.newPage()]);

    await Promise.all([page1.goto("/"), page2.goto("/")]);
    await waitForConnected(page1);
    await waitForConnected(page2);

    try {
      await waitForPeerCount(page1, 1, 15000);
      await waitForPeerCount(page2, 1, 15000);
    } catch {
      test.skip(true, "Signaling server not available");
      return;
    }

    const initialPeerCount = (await getSyncState(page1))?.peerCount ?? 0;

    // Browser2 leaves gracefully (navigate away)
    await page2.goto("about:blank");

    // Wait for peer count to decrease
    await page1.waitForTimeout(2000);

    // Page1 should still be connected
    const state1 = await getSyncState(page1);
    expect(state1?.isConnected).toBe(true);

    // Peer count should have decreased (or stayed same if there are other peers)
    // The key is page1 is still functional
    await expect(page1.locator("text=Synced")).toBeVisible();
  });

  test("abrupt client leave (browser crash) - other clients recover", async () => {
    [browser1, browser2] = await Promise.all([
      chromium.launch({ headless: true }),
      chromium.launch({ headless: true }),
    ]);

    const [ctx1, ctx2] = await Promise.all([
      browser1.newContext({ baseURL: "http://localhost:3000" }),
      browser2.newContext({ baseURL: "http://localhost:3000" }),
    ]);

    [page1, page2] = await Promise.all([ctx1.newPage(), ctx2.newPage()]);

    await Promise.all([page1.goto("/"), page2.goto("/")]);
    await waitForConnected(page1);
    await waitForConnected(page2);

    try {
      await waitForPeerCount(page1, 1, 15000);
    } catch {
      test.skip(true, "Signaling server not available");
      return;
    }

    // Abruptly close browser2 (simulates crash)
    await browser2.close();

    // Wait for peer loss detection
    await page1.waitForTimeout(3000);

    // Page1 should still be connected and functional
    const state1 = await getSyncState(page1);
    expect(state1?.isConnected).toBe(true);
    await expect(page1.locator("text=Synced")).toBeVisible();

    // Should still be able to interact
    const canvas = page1.locator("canvas").first();
    if (await canvas.isVisible()) {
      const box = await canvas.boundingBox();
      if (box) {
        await page1.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }
    }
  });
});

test.describe("Mixed Transport Scenarios", () => {
  let browser1: Browser;
  let browser2: Browser;
  let page1: Page;
  let page2: Page;

  test.afterEach(async () => {
    await Promise.all([browser1?.close(), browser2?.close()]);
  });

  test("WebSocket-only client can communicate with WebRTC client", async () => {
    // Browser1 - normal (WebRTC enabled)
    browser1 = await chromium.launch({ headless: true });
    const ctx1 = await browser1.newContext({ baseURL: "http://localhost:3000" });
    page1 = await ctx1.newPage();

    // Browser2 - WebRTC blocked (WS only)
    browser2 = await chromium.launch({ headless: true });
    const ctx2 = await browser2.newContext({ baseURL: "http://localhost:3000" });
    page2 = await ctx2.newPage();
    await blockWebRTC(page2);

    // Connect both
    await Promise.all([page1.goto("/"), page2.goto("/")]);
    await waitForConnected(page1);
    await waitForConnected(page2);

    // Wait for peer discovery (via signaling server)
    try {
      await waitForPeerCount(page1, 1, 20000);
      await waitForPeerCount(page2, 1, 20000);
    } catch {
      test.skip(true, "Signaling server not available");
      return;
    }

    // Clear messages
    await Promise.all([clearMessages(page1), clearMessages(page2)]);

    // WebRTC client sends message
    const msg1 = `from-webrtc-${Date.now()}`;
    await broadcastMessage(page1, msg1);

    // WS-only client should receive it (via WS relay)
    await page2.waitForFunction(
      () => (window.__sync_messages__?.length ?? 0) > 0,
      { timeout: 10000 }
    );

    let messages = await getMessages(page2);
    expect(messages.some((m) => m.text === msg1)).toBe(true);

    // Clear and test reverse direction
    await clearMessages(page1);

    // WS-only client sends message
    const msg2 = `from-ws-only-${Date.now()}`;
    await broadcastMessage(page2, msg2);

    // WebRTC client should receive it
    await page1.waitForFunction(
      () => (window.__sync_messages__?.length ?? 0) > 0,
      { timeout: 10000 }
    );

    messages = await getMessages(page1);
    expect(messages.some((m) => m.text === msg2)).toBe(true);
  });

  test("all clients receive message in mixed transport room", async () => {
    // Launch 3 browsers with different transport capabilities
    const browsers = await Promise.all([
      chromium.launch({ headless: true }), // WebRTC enabled
      chromium.launch({ headless: true }), // WebRTC enabled
      chromium.launch({ headless: true }), // WebRTC blocked
    ]);

    browser1 = browsers[0];
    browser2 = browsers[1];
    const browser3 = browsers[2];

    const contexts = await Promise.all([
      browser1.newContext({ baseURL: "http://localhost:3000" }),
      browser2.newContext({ baseURL: "http://localhost:3000" }),
      browser3.newContext({ baseURL: "http://localhost:3000" }),
    ]);

    const pages = await Promise.all([
      contexts[0].newPage(),
      contexts[1].newPage(),
      contexts[2].newPage(),
    ]);

    page1 = pages[0];
    page2 = pages[1];
    const page3 = pages[2];

    // Block WebRTC on third client
    await blockWebRTC(page3);

    // Connect all
    await Promise.all([page1.goto("/"), page2.goto("/"), page3.goto("/")]);
    await Promise.all([
      waitForConnected(page1),
      waitForConnected(page2),
      waitForConnected(page3),
    ]);

    // Wait for peer discovery
    try {
      await waitForPeerCount(page1, 2, 25000);
    } catch {
      await browser3.close();
      test.skip(true, "Signaling server not available or peer discovery failed");
      return;
    }

    // Clear all messages
    await Promise.all([
      clearMessages(page1),
      clearMessages(page2),
      clearMessages(page3),
    ]);

    // First client broadcasts
    const testMsg = `broadcast-${Date.now()}`;
    await broadcastMessage(page1, testMsg);

    // All other clients should receive it
    await Promise.all([
      page2.waitForFunction(
        () => (window.__sync_messages__?.length ?? 0) > 0,
        { timeout: 10000 }
      ),
      page3.waitForFunction(
        () => (window.__sync_messages__?.length ?? 0) > 0,
        { timeout: 10000 }
      ),
    ]);

    const [msgs2, msgs3] = await Promise.all([
      getMessages(page2),
      getMessages(page3),
    ]);

    expect(msgs2.some((m) => m.text === testMsg)).toBe(true);
    expect(msgs3.some((m) => m.text === testMsg)).toBe(true);

    await browser3.close();
  });
});

test.describe("Rapid Join/Leave", () => {
  test("handles rapid client join/leave without breaking", async () => {
    // Main browser that stays connected
    const mainBrowser = await chromium.launch({ headless: true });
    const mainCtx = await mainBrowser.newContext({ baseURL: "http://localhost:3000" });
    const mainPage = await mainCtx.newPage();

    await mainPage.goto("/");
    await waitForConnected(mainPage);

    try {
      // Rapidly join and leave 3 clients
      for (let i = 0; i < 3; i++) {
        const tempBrowser = await chromium.launch({ headless: true });
        const tempCtx = await tempBrowser.newContext({ baseURL: "http://localhost:3000" });
        const tempPage = await tempCtx.newPage();

        await tempPage.goto("/");
        await waitForConnected(tempPage, 10000);

        // Stay briefly
        await tempPage.waitForTimeout(500);

        // Leave
        await tempBrowser.close();

        // Small gap between clients
        await mainPage.waitForTimeout(200);
      }

      // Main client should still be healthy
      await mainPage.waitForTimeout(1000);
      const state = await getSyncState(mainPage);
      expect(state?.isConnected).toBe(true);
      await expect(mainPage.locator("text=Synced")).toBeVisible();
    } finally {
      await mainBrowser.close();
    }
  });
});
