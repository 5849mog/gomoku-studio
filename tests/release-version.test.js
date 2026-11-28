import test from "node:test";
import assert from "node:assert/strict";
import { synchronizeRelease } from "../scripts/release-version.js";

const worker = 'const RELEASE = "2026.11.28.4";\nconst VERSION = SHELL_PREFIX + "261128-v102";\n';
test("release preparation advances the service worker cache exactly once", () => {
  const next = synchronizeRelease(worker, "2026.12.01.1");
  assert.equal(next.changed, true);
  assert.match(next.worker, /const RELEASE = "2026\.12\.01\.1";/);
  assert.match(next.worker, /"261201-v103"/);
  assert.deepEqual(synchronizeRelease(next.worker, "2026.12.01.1"), { worker: next.worker, changed: false });
});
test("release preparation rejects rollback and unexpected worker formats", () => {
  assert.throws(() => synchronizeRelease(worker, "2026.11.28.3"), /increase/);
  assert.throws(() => synchronizeRelease(worker, "invalid"), /Invalid/);
  assert.throws(() => synchronizeRelease(worker + worker, "2026.11.28.5"), /format/);
});
