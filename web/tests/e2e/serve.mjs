// A tiny static file server for a built site (dist-e2e/ for the browser
// tests, dist/ for Lighthouse).
//
// Why not `astro preview`: Astro allows only one preview server per project,
// so the tests couldn't start while someone was previewing the real site.
// This serves files exactly as built, like any static host would:
//   /bundesliga/   -> bundesliga/index.html
//   /404/          -> 404.html
//   anything else missing -> 404.html with status 404
//
// Usage: node tests/e2e/serve.mjs <folder> <port>   (or import { serve })
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

/** Serve `folder` on 127.0.0.1:`port`. Resolves with the running server. */
export function serve(folder, port) {
  const root = resolve(folder);

  /** The file for a URL path, or null. Never leaves the root folder. */
  const fileFor = (urlPath) => {
    const path = normalize(join(root, decodeURIComponent(urlPath)));
    if (!path.startsWith(root)) return null;
    const candidates = [path, join(path, "index.html"), `${path.replace(/[\\/]$/, "")}.html`];
    return candidates.find((p) => existsSync(p) && statSync(p).isFile()) ?? null;
  };

  const server = createServer((request, response) => {
    const urlPath = new URL(request.url ?? "/", "http://test").pathname;
    const file = fileFor(urlPath);
    const served = file ?? join(root, "404.html");
    response.writeHead(file ? 200 : 404, {
      "content-type": TYPES[extname(served)] ?? "application/octet-stream",
    });
    response.end(readFileSync(served));
  });
  return new Promise((done) => server.listen(port, "127.0.0.1", () => done(server)));
}

// Run from the command line.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const folder = process.argv[2] ?? "dist-e2e";
  const port = Number(process.argv[3] ?? 4322);
  await serve(folder, port);
  console.log(`[serve] ${resolve(folder)} on http://127.0.0.1:${port}`);
}
