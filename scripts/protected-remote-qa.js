import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createDevServer } from "./dev-server.js";
import { startRemote } from "../remote/server.js";

const server = await createDevServer({ port: 0, isolated: false, root: process.env.GOMOKU_SITE_ROOT });
const origin = `http://127.0.0.1:${server.address().port}`, token = "a".repeat(64);
let searches = 0, bridge, browser, context;
try {
  bridge = await startRemote({ port: 0, token, origins: [origin], threads: 1, runtimeFactory: options => ({
    ready: Promise.resolve(), dispose() {},
    command(job) {
      if (job.type === "search") {
        searches++;
        const index = job.board.findIndex(value => !value);
        setTimeout(() => options.emit({ type: "move", requestId: job.requestId,
          result: { index, backend: "remote-native-avx2", threads: 1, memoryMiB: 256 } }), 20);
      }
    }
  }) });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  context = await browser.newContext({ serviceWorkers: "block" });
  await context.addInitScript(() => { localStorage.setItem("gomoku-pondering", "false"); localStorage.setItem("gomoku-thinking-ms", "100"); });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const ready = () => page.waitForFunction(() => document.querySelector("#boardSvg")?.getAttribute("aria-disabled") === "false", null, { timeout: 60000 });
  await page.goto(origin + "/plain/"); await ready();
  await page.locator("#recordMenu summary").click(); await page.locator("#openRemoteEngine").click();
  await page.locator("#remoteUrl").fill(`http://127.0.0.1:${bridge.port}`);
  await page.locator("#remoteToken").fill(token);
  await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }), page.locator("#remoteConnect").click()]);
  await ready();
  await page.waitForFunction(() => document.querySelector("#openRemoteEngine")?.textContent.includes("线程"), null, { timeout: 30000 });
  await page.locator('[data-index="112"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#boardSvg [data-stone]').length === 2, null, { timeout: 30000 });
  await ready();
  assert.ok(searches > 0, "the protected app must use the remote transport");
  assert.deepEqual(errors, []);
  console.log("PASS protected remote pairing, authentication, and a simulated remote AI reply");
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  if (bridge) await bridge.close();
  await new Promise(resolve => server.close(resolve));
}
