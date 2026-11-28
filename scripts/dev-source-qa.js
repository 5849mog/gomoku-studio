import assert from "node:assert/strict";
import { cp, mkdtemp, appendFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createDevServer } from "./dev-server.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const scratch = await mkdtemp(path.join(tmpdir(), "gomoku-source-qa-"));
const omitted = new Set([".git", ".cache", "node_modules", "_site"]);
let server, browser, context;
try {
  await cp(root, scratch, { recursive: true, filter: name => {
    const relative = path.relative(root, name);
    return !omitted.has(relative.split(path.sep)[0]) && !name.endsWith(".protected.js");
  } });
  server = await createDevServer({ port: 0, isolated: false, root: scratch, source: true });
  const origin = `http://127.0.0.1:${server.address().port}/__source__/`;
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  context = await browser.newContext();
  const page = await context.newPage(), errors = [], requests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => requests.push(request.url()));
  const ready = () => page.waitForFunction(() => document.querySelector("#boardSvg")?.getAttribute("aria-disabled") === "false", null, { timeout: 60000 });
  await page.goto(origin); await ready();
  assert.equal(await page.evaluate(() => globalThis.__GOMOKU_SOURCE_DEV__), true);
  assert.equal(await page.evaluate(() => globalThis.__SOURCE_QA_PROBE__), undefined);
  assert.ok(requests.some(url => /\/opening-app\.js(?:\?|$)/.test(url)));
  assert.equal(requests.some(url => /\.protected\.js(?:\?|$)/.test(url)), false);
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
  await page.locator("#timeSelect").selectOption("100");
  await page.locator('[data-index="112"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#boardSvg [data-stone]').length === 2, null, { timeout: 45000 });
  console.log("PASS source mode runs without generated bundles, using the real engine");
  await appendFile(path.join(scratch, "opening-app.js"), "\n;globalThis.__SOURCE_QA_PROBE__ = 73;\n");
  await page.reload(); await ready();
  assert.equal(await page.evaluate(() => globalThis.__SOURCE_QA_PROBE__), 73);
  assert.equal(await page.locator("#boardSvg [data-stone]").count(), 2);
  console.log("PASS source changes appear after refresh and preserve the development game");
  await page.goto(new URL("about.html", origin).href);
  assert.equal(await page.title(), "About Gomoku Studio");
  await page.goto(new URL("report.html", origin).href);
  assert.ok((await page.title()).length);
  await page.goto(new URL("update.html", origin).href);
  await page.waitForFunction(() => document.querySelector("[data-app-version]")?.textContent.includes("源码开发模式"));
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
  assert.deepEqual(errors, []);
  console.log("PASS source-mode auxiliary pages and disabled service worker");
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, { recursive: true, force: true });
}
