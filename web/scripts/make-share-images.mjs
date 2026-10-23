// Draws the share images: the picture a chat or social app shows when someone
// pastes a link to the site (Open Graph og:image, 1200 x 630 PNG).
//   public/share/tabletalk.png         the site as a whole (home, track record, ...)
//   public/share/<league slug>.png     one per league: its page, matches page and team pages
// No numbers on them, so they're never out of date: apps keep a link's
// preview for days or weeks. Floodlights look (the default dark theme), with
// the same mark as the home-screen icons, in the site's own fonts. Important
// text keeps to the left and middle, as some apps crop the image.
// Rendered with Playwright's Chromium (already a dev dependency), like
// scripts/make-icons.mjs, so no image tool is needed.
//
// Run: node scripts/make-share-images.mjs   (only when the design or the leagues change; the PNGs are committed)
// src/layouts/Base.astro points each page at its image; the build check
// fails if a page points at an image that isn't in the build.
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import { LEAGUES } from "../src/data/leagues.ts";
import { SHARE_IMAGE } from "../src/data/share.ts";

const require = createRequire(import.meta.url);
/** A font file from node_modules as a data: URL (the page has no address to load files from). */
const font = (file) => `data:font/woff2;base64,${readFileSync(require.resolve(file)).toString("base64")}`;
const DISPLAY = font("@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2");
const TEXT = font("@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2");

// Floodlights (src/styles/themes/floodlights.css).
const BG = "#0b1210";
const TEXT_COLOUR = "#edf3ef";
const MUTED = "#a0b0a6";
const ACCENT = "#3fd98a";
const PITCH_LINE = "rgb(63 217 138 / 16%)";

const { width, height } = SHARE_IMAGE;

/** One image's HTML: brand, a big title, one line under it, and the address and caveat at the foot. */
function card(title, line) {
  return `<!doctype html><html><head><style>
  @font-face { font-family: "Barlow Condensed"; font-weight: 700; src: url(${DISPLAY}) format("woff2"); }
  @font-face { font-family: "Source Sans 3"; font-weight: 200 900; src: url(${TEXT}) format("woff2"); }
  html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; background: ${BG}; }
  body { position: relative; font-family: "Source Sans 3"; color: ${TEXT_COLOUR}; }
  .pitch { position: absolute; right: -170px; top: 50%; transform: translateY(-50%); }
  .inner { position: absolute; inset: 64px 80px 56px; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 18px; font-family: "Barlow Condensed"; font-weight: 700;
    font-size: 52px; letter-spacing: 0.01em; }
  .brand svg { width: 56px; height: 56px; }
  h1 { margin: auto 0 0; font-family: "Barlow Condensed"; font-weight: 700; font-size: 132px; line-height: 0.95;
    text-transform: uppercase; letter-spacing: 0.01em; max-width: 1040px; }
  p.line { margin: 24px 0 0; font-size: 38px; line-height: 1.3; color: ${TEXT_COLOUR}; max-width: 860px; }
  .foot { margin-top: auto; display: flex; justify-content: space-between; align-items: baseline;
    font-size: 28px; color: ${MUTED}; }
  .foot strong { color: ${ACCENT}; font-weight: 600; }
</style></head><body>
  <svg class="pitch" width="640" height="640" viewBox="0 0 24 24" fill="none" stroke="${PITCH_LINE}" stroke-width="0.35">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="2" x2="12" y2="22"/><circle cx="12" cy="12" r="3"/>
  </svg>
  <div class="inner">
    <div class="brand">
      <svg viewBox="0 0 24 24" fill="none" stroke="${ACCENT}" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="2" x2="12" y2="22"/><circle cx="12" cy="12" r="3"/>
      </svg>
      TableTalk
    </div>
    <h1>${title}</h1>
    <p class="line">${line}</p>
    <div class="foot"><strong>tabletalk.fyi</strong><span>Model probabilities, not betting advice</span></div>
  </div>
</body></html>`;
}

const IMAGES = [
  { file: "tabletalk", title: "Season forecasts", line: SHARE_IMAGE.siteLine },
  ...LEAGUES.map((league) => ({ file: league.slug, title: league.name, line: SHARE_IMAGE.leagueLine })),
];

mkdirSync("public/share", { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width, height } });
  for (const image of IMAGES) {
    await page.setContent(card(image.title, image.line));
    await page.evaluate(() => document.fonts.ready);
    const path = `public/share/${image.file}.png`;
    await page.screenshot({ path, clip: { x: 0, y: 0, width, height } });
    console.log(`wrote ${path}`);
  }
} finally {
  await browser.close();
}
