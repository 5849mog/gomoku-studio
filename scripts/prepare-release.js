import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { APP_VERSION } from "../app-release.js";
import { synchronizeRelease } from "./release-version.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const feed = JSON.parse(await readFile(new URL("../content/feed.json", import.meta.url), "utf8"));
if (feed.releases?.[0]?.version !== APP_VERSION) {
  throw Error("Update the latest content/feed.json entry to match app-release.js first.");
}
const workerPath = new URL("../sw.js", import.meta.url);
const { worker, changed } = synchronizeRelease(await readFile(workerPath, "utf8"), APP_VERSION);
if (changed) {
  await writeFile(workerPath, worker);
  console.log("Synchronized service worker release and advanced its shell cache.");
}
for (const args of [
  ["scripts/sync-pages.js"], ["scripts/build-protected.js"],
  ["scripts/check.js"], ["scripts/build-protected.js", "--check"]
]) {
  const child = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (child.error) throw child.error;
  if (child.status !== 0) process.exit(child.status ?? 1);
}
console.log("Release files are ready; review and commit the changes.");
