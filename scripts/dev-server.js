import http from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
  ".wasm": "application/wasm", ".data": "application/octet-stream", ".ttf": "font/ttf", ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8" };

export function createDevServer({ port = 4187, isolated = true, root = ROOT, source = false } = {}) {
  const siteRoot = path.resolve(root);
  const server = http.createServer(async (req, res) => {
    try {
      const raw = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      // A separate path avoids old published service-worker caches, while the
      // default programmatic server continues to exercise published bundles.
      if (source && raw === "/") { res.writeHead(302, { Location: "/__source__/" }); res.end(); return; }
      if (source && !raw.startsWith("/__source__/")) { res.writeHead(404); res.end(); return; }
      const requested = source ? raw.slice("/__source__".length) : raw;
      // These aliases also exercise GitHub Pages and header-free hosting in QA.
      const plain = requested.startsWith("/plain/");
      const relative = requested.replace(/^\/(?:ai|plain)\//, "/").replace(/^\//, "");
      if (relative.split(/[\\/]/).some(part => part.startsWith(".")) || !["GET", "HEAD"].includes(req.method)) {
        res.writeHead(403); res.end(); return;
      }
      const file = path.resolve(siteRoot, relative || "index.html", raw.endsWith("/") && relative ? "index.html" : "");
      if (!file.startsWith(siteRoot + path.sep)) { res.writeHead(403); res.end(); return; }
      const info = await stat(file);
      if (!info.isFile()) { res.writeHead(404); res.end(); return; }
      if (isolated && !plain) {
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      }
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      res.setHeader("Content-Type", MIME[path.extname(file)] || "application/octet-stream");
      if (source && path.extname(file) === ".html") {
        const html = (await readFile(file, "utf8"))
          .replace(/<head>/i, '$&\n<script>globalThis.__GOMOKU_SOURCE_DEV__ = true;</script>')
          .replace(/<script\b[^>]*\bsrc="\.\/[^"?]+\.protected\.js(?:\?[^"]*)?"[^>]*>/g,
            tag => tag.replace(".protected.js", ".js").replace(/\s+integrity="[^"]*"/g, "")
              .replace(/\s+crossorigin="[^"]*"/g, "").replace(/\s+data-integrity-guard="[^"]*"/g, ""));
        res.setHeader("Content-Length", Buffer.byteLength(html));
        res.setHeader("Cache-Control", "no-store");
        res.writeHead(200); res.end(req.method === "HEAD" ? undefined : html); return;
      }
      res.setHeader("Content-Length", info.size);
      res.setHeader("Cache-Control", relative.startsWith("engine/") ? "public, max-age=31536000, immutable" : "no-cache");
      res.writeHead(200);
      if (req.method === "HEAD") res.end();
      else createReadStream(file).on("error", () => res.destroy()).pipe(res);
    } catch { res.writeHead(404); res.end("Not found"); }
  });
  return new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", () => resolve(server)); });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = !process.argv.includes("--protected");
  const server = await createDevServer({ port: Number(process.env.PORT || 4187), isolated: !process.argv.includes("--plain"), source });
  console.log(`五目 ${source ? "源码开发" : "发布构建"}: http://127.0.0.1:${server.address().port}/${source ? "__source__/" : ""}`);
}
