// @ts-check
import { readFileSync } from "node:fs";
import { defineConfig } from "astro/config";
import { buildThemeScript, cspHash } from "./src/scripts/theme-script.ts";

// The site's public address is decided in the deployment step (after the
// pipeline trial). Until then pages are previewed locally, so Open Graph
// URLs point at the local preview server unless SITE_URL is set.
const site = process.env.SITE_URL ?? "http://localhost:4321";

// The inline theme script that runs before the page paints (see Base.astro).
const themeScript = buildThemeScript(
  readFileSync(new URL("./src/scripts/theme-head.js", import.meta.url), "utf8"),
);

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  // Pages are plain HTML: no prefetching or client router, so no extra scripts.
  prefetch: false,
  // No code blocks on the site; Shiki's inline styles would break the CSP.
  markdown: { syntaxHighlight: false },
  security: {
    // Content Security Policy as a <meta> tag, because the likely host
    // (GitHub Pages) cannot send custom headers. Astro adds a hash for every
    // script and style it bundles; the inline theme script's hash is added
    // here. Nothing else can run, and inline style="" attributes are not
    // allowed anywhere in the site.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ],
      scriptDirective: { hashes: [cspHash(themeScript)] },
    },
  },
});
