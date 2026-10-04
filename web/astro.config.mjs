// @ts-check
import { defineConfig } from "astro/config";
import { FILL_SCRIPT, cspHash, earlyScript } from "./src/scripts/theme-script.ts";

// The site's public address: ONE setting, the SITE_URL environment variable
// (e.g. SITE_URL=https://example.org npm run build), decided at deployment.
// It is used only for each page's canonical link and og:url. Without it those
// two tags are left out, never pointed at a local address, and
// scripts/check-build.mjs fails any build whose HTML mentions localhost.
const site = process.env["SITE_URL"] || undefined;
if (site !== undefined && !/^https:\/\/[^/]+/.test(site)) {
  throw new Error(`SITE_URL must be an https:// address, got "${site}"`);
}

// The inline early script that runs before the page paints (theme and
// favourite team, see Base.astro). It contains this build's team list, so it
// is built from the data, here and in Base.astro, with the same function.
const themeScript = earlyScript();

export default defineConfig({
  // Only set when SITE_URL is (Astro's `site` can't be undefined).
  ...(site ? { site } : {}),
  output: "static",
  // The browser tests build a separate test site into dist-e2e/ (see playwright.config.ts).
  outDir: process.env.TABLETALK_OUT_DIR ?? "dist",
  trailingSlash: "always",
  build: { format: "directory" },
  // Pages are plain HTML: no prefetching or client router, so no extra scripts.
  prefetch: false,
  // No code blocks on the site; Shiki's inline styles would break the CSP.
  markdown: { syntaxHighlight: false },
  security: {
    // Content Security Policy as a <meta> tag, because the likely host
    // (GitHub Pages) cannot send custom headers. Astro adds a hash for every
    // script and style it bundles; the two inline scripts' hashes are added
    // here (the early script, and the fixed one-line FILL_SCRIPT). Nothing else can run, and inline style="" attributes are not
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
      scriptDirective: { hashes: [cspHash(themeScript), cspHash(FILL_SCRIPT)] },
    },
  },
});
