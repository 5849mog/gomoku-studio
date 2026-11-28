import { createHash } from "node:crypto";

// Harmless, local analysis noise. Results are discarded and never used by the
// app, sent to a server, or used for authorization. They are not secrets.
export function protectionDecoys(name, source) {
  const hash = createHash("sha256").update("gomoku-decoys-v1\0").update(name).update("\0").update(source).digest("hex");
  const families = ["gomoku-opening", "gomoku-remote", "gomoku-session", "gomoku-state"];
  const sections = ["cache", "session", "engine", "route", "rules", "client"];
  const functions = [];
  for (let group = 0; group < 6; group++) {
    const strings = [];
    for (let i = 0; i < 8; i++) {
      const slot = (group * 8 + i) % (hash.length - 8);
      strings.push(families[(group + i) % families.length] + ":/" + sections[(group * 3 + i) % sections.length]
        + "/" + hash.slice(slot, slot + 8) + "/:v1");
    }
    functions.push(`function f${group}(n){const v=${JSON.stringify(strings)};return v[((n^${group + 11})>>>0)%v.length]}`);
  }
  const calls = functions.map((_, i) => `f${i}(${i + 17});`).join("");
  return `\n;(function(){${functions.join("")}${calls}})();\n`;
}
