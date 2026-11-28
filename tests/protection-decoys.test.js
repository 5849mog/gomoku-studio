import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { protectionDecoys } from "../scripts/protection-decoys.js";

test("decoys are repeatable, content-specific, and do not interact with the browser environment", () => {
  const code = protectionDecoys("app.js", "source one");
  assert.equal(code, protectionDecoys("app.js", "source one"));
  assert.notEqual(code, protectionDecoys("app.js", "source two"));
  const noAccess = new Proxy({}, { get() { throw Error("unexpected browser access"); }, set() { throw Error("unexpected browser mutation"); } });
  const context = { globalThis: noAccess, fetch() { throw Error("unexpected network"); }, localStorage: noAccess };
  vm.runInNewContext(code, context, { timeout: 1000 });
});
