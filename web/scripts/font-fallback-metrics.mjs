// Measures the numbers for the fallback fonts in src/styles/fonts.css.
//
//   npm run build && node scripts/font-fallback-metrics.mjs
//
// While a web font downloads, the browser shows a fallback font, then swaps.
// If the two have different widths or line heights, the text reflows and the
// page jumps (layout shift). So the fallback (Arial, installed on Windows,
// macOS and iOS) is adjusted to match each web font:
//   size-adjust      scales Arial so the same text is the same width;
//   ascent-override  and descent-override set the space above and below the
//                    baseline to the web font's, so lines are the same height.
// Measured in Chromium with the canvas API on a sample of typical site text,
// at 100px. The results are printed as CSS to paste into fonts.css.
import { chromium } from "@playwright/test";
import { serve } from "../tests/e2e/serve.mjs";

const PORT = 4332;
const SAMPLE =
  "Manchester City 59% Borussia Mönchengladbach Proj. pts Title favourite Relegation 2026-27 Arsenal v Leeds United 12:30";
const FONTS = [
  { family: "Barlow Condensed", weight: 700, fallback: "Barlow Condensed Fallback" },
  { family: "Source Sans 3 Variable", weight: 400, fallback: "Source Sans 3 Fallback" },
];

const server = await serve(process.argv[2] ?? "dist", PORT);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });

for (const font of FONTS) {
  const m = await page.evaluate(
    async ({ family, weight, sample }) => {
      await document.fonts.load(`${weight} 100px "${family}"`, sample);
      const context = document.createElement("canvas").getContext("2d");
      const measure = (fontFamily) => {
        context.font = `${weight} 100px ${fontFamily}`;
        const metrics = context.measureText(sample);
        return {
          width: metrics.width,
          ascent: metrics.fontBoundingBoxAscent / 100,
          descent: metrics.fontBoundingBoxDescent / 100,
        };
      };
      return { web: measure(`"${family}"`), arial: measure("Arial") };
    },
    { family: font.family, weight: font.weight, sample: SAMPLE },
  );
  const sizeAdjust = m.web.width / m.arial.width;
  const percent = (x) => `${(x * 100).toFixed(2)}%`;
  console.log(`/* ${font.fallback}: Arial scaled to match ${font.family} ${font.weight}. */
@font-face {
  font-family: "${font.fallback}";
  src: local("Arial");
  size-adjust: ${percent(sizeAdjust)};
  ascent-override: ${percent(m.web.ascent / sizeAdjust)};
  descent-override: ${percent(m.web.descent / sizeAdjust)};
  line-gap-override: 0%;
}
`);
}

await browser.close();
server.close();
