// A tiny static file server for the browser tests' site (dist-e2e/).
//
// Why not `astro preview`: Astro allows only one preview server per project,
// so the tests couldn't start while someone was previewing the real site.
// This serves files exactly as built, like any static host would:
//   /bundesliga/   -> bundesliga/index.html
//   /404/          -> 404.html
//   anything else missing -> 404.html with status 404
//
// Usage: node tests/e2e/serve.mjs <folder> <port>
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "dist-e2e");
const port = Number(process.argv[3] ?? 4322);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

/** The file for a URL path, or null. Never leaves the root folder. */
function fileFor(urlPath) {
  const path = normalize(join(root, decodeURIComponent(urlPath)));
  if (!path.startsWith(root)) return null;
  const candidates = [path, join(path, "index.html"), `${path.replace(/[\\/]$/, "")}.html`];
  return candidates.find((p) => existsSync(p) && statSync(p).isFile()) ?? null;
}

createServer((request, response) => {
  const urlPath = new URL(request.url ?? "/", "http://test").pathname;
  const file = fileFor(urlPath);
  const status = file ? 200 : 404;
  const served = file ?? join(root, "404.html");
  response.writeHead(status, { "content-type": TYPES[extname(served)] ?? "application/octet-stream" });
  response.end(readFileSync(served));
}).listen(port, "127.0.0.1", () => console.log(`[serve] ${root} on http://127.0.0.1:${port}`));
