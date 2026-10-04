// Draws the home-screen icons named in public/manifest.webmanifest:
//   public/icon-192.png, public/icon-512.png   the mark on the Floodlights background
//   public/icon-maskable-512.png               the same, smaller, so Android can crop it
//                                              to a circle or squircle (safe zone: the
//                                              central 80%)
// Same design as public/apple-touch-icon.png: the halfway-line mark in pitch
// green on the dark Floodlights surface. Rendered with Playwright's Chromium
// (already a dev dependency), so no image tool is needed.
//
// Run: node scripts/make-icons.mjs   (only when the design changes; the PNGs are committed)
import { chromium } from "@playwright/test";

const BACKGROUND = "#0b1210"; // Floodlights --bg
const MARK = "#3fd98a"; // Floodlights --accent

/** The mark as SVG, `scale` = share of the icon's width the outer circle fills. */
function svg(size, scale) {
  const r = (size * scale) / 2;
  const c = size / 2;
  const stroke = size * 0.045;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BACKGROUND}"/>
  <g fill="none" stroke="${MARK}" stroke-width="${stroke}">
    <circle cx="${c}" cy="${c}" r="${r - stroke / 2}"/>
    <line x1="${c}" y1="${c - r + stroke / 2}" x2="${c}" y2="${c + r - stroke / 2}"/>
    <circle cx="${c}" cy="${c}" r="${r * 0.3}"/>
  </g>
</svg>`;
}

const ICONS = [
  { file: "public/icon-192.png", size: 192, scale: 0.72 },
  { file: "public/icon-512.png", size: 512, scale: 0.72 },
  // Maskable: everything inside the central 80% circle (diameter 0.8), with margin.
  { file: "public/icon-maskable-512.png", size: 512, scale: 0.56 },
];

const browser = await chromium.launch();
try {
  for (const icon of ICONS) {
    const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });
    await page.setContent(
      `<html><body style="margin:0;background:${BACKGROUND}">${svg(icon.size, icon.scale)}</body></html>`,
    );
    await page.screenshot({ path: icon.file, clip: { x: 0, y: 0, width: icon.size, height: icon.size } });
    await page.close();
    console.log(`wrote ${icon.file}`);
  }
} finally {
  await browser.close();
}
