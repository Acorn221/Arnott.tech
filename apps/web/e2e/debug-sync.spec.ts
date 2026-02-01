import { test, chromium } from "@playwright/test";

test("debug peer discovery", async () => {
  const [browser1, browser2] = await Promise.all([
    chromium.launch({ headless: true }),
    chromium.launch({ headless: true }),
  ]);

  const [ctx1, ctx2] = await Promise.all([
    browser1.newContext({ baseURL: "http://localhost:3000" }),
    browser2.newContext({ baseURL: "http://localhost:3000" }),
  ]);

  const [page1, page2] = await Promise.all([ctx1.newPage(), ctx2.newPage()]);

  // Capture console logs
  page1.on("console", (msg) => console.log("[Browser1]", msg.text()));
  page2.on("console", (msg) => console.log("[Browser2]", msg.text()));

  // Connect first browser
  await page1.goto("/");
  await page1.waitForFunction(() => window.__sync_coordinator__?.isConnected);

  // Wait for leader election
  await page1.waitForTimeout(1000);

  const state1 = await page1.evaluate(() => ({
    isConnected: window.__sync_coordinator__?.isConnected,
    isLeader: window.__sync_coordinator__?.isLeader,
    peerCount: window.__sync_coordinator__?.peerCount,
    // @ts-ignore
    transports: Array.from(window.__sync_coordinator__?.transports?.keys?.() || []),
  }));
  console.log("Browser1 state after connect:", JSON.stringify(state1));

  // Connect second browser
  await page2.goto("/");
  await page2.waitForFunction(() => window.__sync_coordinator__?.isConnected);
  await page2.waitForTimeout(1000);

  const state2 = await page2.evaluate(() => ({
    isConnected: window.__sync_coordinator__?.isConnected,
    isLeader: window.__sync_coordinator__?.isLeader,
    peerCount: window.__sync_coordinator__?.peerCount,
    // @ts-ignore
    transports: Array.from(window.__sync_coordinator__?.transports?.keys?.() || []),
  }));
  console.log("Browser2 state after connect:", JSON.stringify(state2));

  // Check browser1 again after browser2 connected
  await page1.waitForTimeout(2000);
  const state1After = await page1.evaluate(() => ({
    isConnected: window.__sync_coordinator__?.isConnected,
    peerCount: window.__sync_coordinator__?.peerCount,
    // @ts-ignore
    peers: window.__sync_coordinator__?.peers?.map((p: any) => p.id),
  }));
  console.log("Browser1 state after browser2:", JSON.stringify(state1After));

  const state2After = await page2.evaluate(() => ({
    isConnected: window.__sync_coordinator__?.isConnected,
    peerCount: window.__sync_coordinator__?.peerCount,
    // @ts-ignore
    peers: window.__sync_coordinator__?.peers?.map((p: any) => p.id),
  }));
  console.log("Browser2 state after wait:", JSON.stringify(state2After));

  await Promise.all([browser1.close(), browser2.close()]);
});
