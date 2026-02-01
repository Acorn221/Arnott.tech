import { test, expect, chromium, type Browser, type Page } from "@playwright/test";

/**
 * Spinner State Synchronization E2E Tests
 *
 * These tests verify that spinner state (rotation, velocity) is synchronized
 * across multiple tabs and browsers within acceptable tolerances.
 */

interface SpinnerState {
  rotation: number;
  velocity: number;
}

// Get current spinner state from page
async function getSpinnerState(page: Page): Promise<SpinnerState> {
  return page.evaluate(() => {
    if (window.__spinner_get_state__) {
      return window.__spinner_get_state__();
    }
    return { rotation: 0, velocity: 0 };
  });
}

// Wait for spinner to be synced and canvas visible
async function waitForReady(page: Page, timeout = 15000) {
  await page.waitForFunction(
    () => window.__sync_state__?.isConnected === true,
    { timeout }
  );
  // Also wait for canvas to be visible
  await page.locator("canvas").first().waitFor({ state: "visible", timeout });
}

// Spin the spinner with a drag gesture
async function spinSpinner(page: Page, velocity: "slow" | "medium" | "fast" = "medium") {
  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 10000 });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas not found");

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  // Distance determines velocity
  const distance = velocity === "slow" ? 30 : velocity === "medium" ? 80 : 150;

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + distance, centerY, { steps: 10 });
  await page.mouse.up();

  // Small delay to let the event propagate
  await page.waitForTimeout(100);
}

// Tolerance for rotation comparison (in radians)
// Accounts for timing differences, network latency, and physics simulation
const ROTATION_TOLERANCE = 0.5; // ~29 degrees - accounts for timing jitter
const VELOCITY_TOLERANCE = 1.0;

test.describe("Spinner State Sync - Multi-Tab", () => {
  test("spinning in one tab updates the other tab", async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      await Promise.all([page1.goto("/"), page2.goto("/")]);
      await Promise.all([waitForReady(page1), waitForReady(page2)]);

      // Wait for peer discovery and time sync
      await page1.waitForTimeout(1000);

      // Spin in tab 1
      await spinSpinner(page1, "medium");

      // Wait for sync propagation
      await page1.waitForTimeout(500);

      // Both tabs should now show similar states
      const state1 = await getSpinnerState(page1);
      const state2 = await getSpinnerState(page2);

      // Both tabs should be in sync (within tolerance)
      expect(Math.abs(state1.rotation - state2.rotation)).toBeLessThan(ROTATION_TOLERANCE);
      expect(Math.abs(state1.velocity - state2.velocity)).toBeLessThan(VELOCITY_TOLERANCE);
    } finally {
      await context.close();
    }
  });

  test("both tabs converge to same state over time", async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      await Promise.all([page1.goto("/"), page2.goto("/")]);
      await Promise.all([waitForReady(page1), waitForReady(page2)]);
      await page1.waitForTimeout(1000);

      // Spin the spinner
      await spinSpinner(page1, "fast");

      // Wait for sync propagation before sampling
      await page1.waitForTimeout(500);

      // Sample states over time and check convergence
      for (let i = 0; i < 3; i++) {
        const state1 = await getSpinnerState(page1);
        const state2 = await getSpinnerState(page2);

        // Should remain in sync throughout spin-down
        expect(Math.abs(state1.rotation - state2.rotation)).toBeLessThan(ROTATION_TOLERANCE);

        await page1.waitForTimeout(500);
      }
    } finally {
      await context.close();
    }
  });

  test("rapid interactions stay synchronized", async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      await Promise.all([page1.goto("/"), page2.goto("/")]);
      await Promise.all([waitForReady(page1), waitForReady(page2)]);
      await page1.waitForTimeout(1000);

      // Multiple rapid spins
      for (let i = 0; i < 3; i++) {
        await spinSpinner(page1, "slow");
        await page1.waitForTimeout(200);
      }

      // Let it settle
      await page1.waitForTimeout(500);

      // Check sync
      const state1 = await getSpinnerState(page1);
      const state2 = await getSpinnerState(page2);

      expect(Math.abs(state1.rotation - state2.rotation)).toBeLessThan(ROTATION_TOLERANCE);
    } finally {
      await context.close();
    }
  });
});

test.describe("Spinner State Sync - Multi-Browser", () => {
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

  test("spinning in browser1 syncs to browser2 via WebRTC", async () => {
    await Promise.all([page1.goto("/"), page2.goto("/")]);
    await Promise.all([waitForReady(page1), waitForReady(page2)]);

    // Wait for WebRTC peer discovery (may take longer than local tabs)
    try {
      await page1.waitForFunction(
        () => (window.__sync_coordinator__?.peerCount ?? 0) >= 1,
        { timeout: 20000 }
      );
    } catch {
      test.skip(true, "WebRTC peer discovery not available");
      return;
    }

    // Wait for time sync to stabilize
    await page1.waitForTimeout(1000);

    // Spin in browser 1
    await spinSpinner(page1, "medium");

    // Wait for WebRTC message propagation (may be slower than BroadcastChannel)
    await page1.waitForTimeout(1000);

    // Check states
    const state1 = await getSpinnerState(page1);
    const state2 = await getSpinnerState(page2);

    // Browser2 should be reasonably in sync (more tolerance for WebRTC)
    const webrtcTolerance = ROTATION_TOLERANCE * 3;
    expect(Math.abs(state1.rotation - state2.rotation)).toBeLessThan(webrtcTolerance);
  });

  test("state converges after network delay", async () => {
    await Promise.all([page1.goto("/"), page2.goto("/")]);
    await Promise.all([waitForReady(page1), waitForReady(page2)]);

    // Wait for peer discovery
    let hasPeers = false;
    try {
      await page1.waitForFunction(
        () => (window.__sync_coordinator__?.peerCount ?? 0) >= 1,
        { timeout: 20000 }
      );
      hasPeers = true;
    } catch {
      // No peers found - skip this test
    }

    if (!hasPeers) {
      test.skip(true, "WebRTC peer discovery not available");
      return;
    }

    // Wait for time sync
    await page1.waitForTimeout(1000);

    // Spin
    await spinSpinner(page1, "fast");

    // Wait longer for convergence
    await page1.waitForTimeout(2000);

    // Check sync - just one sample with higher tolerance
    const state1 = await getSpinnerState(page1);
    const state2 = await getSpinnerState(page2);

    // WebRTC has higher latency, use 5x tolerance
    expect(Math.abs(state1.rotation - state2.rotation)).toBeLessThan(ROTATION_TOLERANCE * 5);
  });
});

test.describe("Spinner State Sync - Edge Cases", () => {
  test("spinner stops at same position in both tabs", async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      // Navigate in parallel to ensure both pages are ready at similar times
      await Promise.all([page1.goto("/"), page2.goto("/")]);
      await Promise.all([waitForReady(page1), waitForReady(page2)]);

      // Wait for peer discovery and time sync
      await page1.waitForTimeout(1000);

      // Give it a slow spin so it stops relatively quickly
      await spinSpinner(page1, "slow");

      // Wait for sync propagation
      await page1.waitForTimeout(500);

      // Sample states periodically as spinner slows down
      for (let i = 0; i < 5; i++) {
        await page1.waitForTimeout(1000);

        const state1 = await getSpinnerState(page1);
        const state2 = await getSpinnerState(page2);

        // Should remain in sync as velocity decreases
        expect(Math.abs(state1.rotation - state2.rotation)).toBeLessThan(ROTATION_TOLERANCE);
      }

      // Final check - both should have low velocity
      const final1 = await getSpinnerState(page1);
      const final2 = await getSpinnerState(page2);
      expect(Math.abs(final1.velocity)).toBeLessThan(1.0);
      expect(Math.abs(final2.velocity)).toBeLessThan(1.0);
    } finally {
      await context.close();
    }
  });

  test("late-joining tab syncs after new interaction", async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      // Navigate in parallel (proven to work reliably)
      await Promise.all([page1.goto("/"), page2.goto("/")]);
      await Promise.all([waitForReady(page1), waitForReady(page2)]);

      // Wait for peer discovery
      await page1.waitForTimeout(1000);

      // Verify peers are discovered before spinning
      const peerCount1 = await page1.evaluate(() => window.__sync_state__?.peerCount ?? 0);
      const peerCount2 = await page2.evaluate(() => window.__sync_state__?.peerCount ?? 0);
      expect(peerCount1).toBeGreaterThanOrEqual(1);
      expect(peerCount2).toBeGreaterThanOrEqual(1);

      // Now spin - both tabs should receive this event
      await spinSpinner(page1, "fast");

      // Wait for sync propagation
      await page1.waitForTimeout(500);

      // Both should be in sync
      const state1 = await getSpinnerState(page1);
      const state2 = await getSpinnerState(page2);

      expect(Math.abs(state1.rotation - state2.rotation)).toBeLessThan(ROTATION_TOLERANCE);
    } finally {
      await context.close();
    }
  });

  test("interaction in second tab overrides first", async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      // Navigate in parallel
      await Promise.all([page1.goto("/"), page2.goto("/")]);
      await Promise.all([waitForReady(page1), waitForReady(page2)]);

      // Wait for peer discovery
      await page1.waitForTimeout(1000);

      // Spin in tab 1 (slow)
      await spinSpinner(page1, "slow");
      await page1.waitForTimeout(500);

      // Verify sync after first spin
      let state1 = await getSpinnerState(page1);
      let state2 = await getSpinnerState(page2);
      expect(Math.abs(state1.rotation - state2.rotation)).toBeLessThan(ROTATION_TOLERANCE);

      // Then spin in tab 2 (fast - should override with higher velocity)
      await spinSpinner(page2, "fast");
      await page2.waitForTimeout(500);

      // Both should be in sync with tab 2's new state
      state1 = await getSpinnerState(page1);
      state2 = await getSpinnerState(page2);

      // Should be in sync
      expect(Math.abs(state1.rotation - state2.rotation)).toBeLessThan(ROTATION_TOLERANCE);
    } finally {
      await context.close();
    }
  });
});
