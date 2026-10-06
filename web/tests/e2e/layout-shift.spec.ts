// Nothing moves while the page loads, even on a slow connection (Step 4c).
//
// 1. Late web fonts. The fonts use font-display: optional, so a font that
//    arrives late is not swapped in (it is used from the next page). Here
//    every font file is held back for 1.5 s; before 4c, with "swap", the
//    header and table columns moved sideways when it arrived, and the track
//    record page on a phone re-wrapped (a shift of 0.17).
// 2. Out-of-date numbers. The warning is CSS set by the early script before
//    the first paint, not text rewritten after load (which pushed the Ligue 1
//    page down by 0.04 on a phone). The test data's Ligue 1 numbers are 52
//    hours old at FIXTURE_NOW.
//
// The one movement left is times rewritten in the visitor's zone ("UTC"
// disappears): sideways, about 0.002.
import type { Page } from "@playwright/test";
import { expect, test } from "./test.ts";

const PAGES = [
  "/",
  "/premier-league/",
  "/premier-league/matches/",
  "/premier-league/brentford/",
  "/ligue-1/",
  "/track-record/",
  "/methodology/",
];
const MAX_SHIFT = 0.005;

/** Total layout shift during the load, with what moved (for the failure message). */
async function shiftDuringLoad(page: Page, path: string): Promise<{ total: number; moved: string[] }> {
  await page.addInitScript(() => {
    const w = window as unknown as { __shift: number; __moved: string[] };
    w.__shift = 0;
    w.__moved = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
        sources: { node?: Node }[];
      }[]) {
        if (entry.hadRecentInput) continue;
        w.__shift += entry.value;
        for (const s of entry.sources) {
          const name = s.node instanceof Element ? `${s.node.tagName}.${s.node.className}` : s.node?.nodeName;
          w.__moved.push(`${name} (${entry.value.toFixed(4)})`);
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const w = window as unknown as { __shift: number; __moved: string[] };
    return { total: w.__shift, moved: w.__moved };
  });
}

for (const width of [390, 1280]) {
  test.describe(`${width}px, every font 1.5 s late`, () => {
    for (const path of PAGES) {
      test(path, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.route(/[.]woff2$/, async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await route.continue();
        });
        const { total, moved } = await shiftDuringLoad(page, path);
        expect(total, moved.join("; ")).toBeLessThan(MAX_SHIFT);
      });
    }
  });
}

test("out-of-date numbers: the warning is there from the first paint (Ligue 1, phone)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const { total, moved } = await shiftDuringLoad(page, "/ligue-1/");
  expect(total, moved.join("; ")).toBeLessThan(MAX_SHIFT);
  const line = page.locator("[data-stale-message]").first();
  expect(await line.evaluate((el) => getComputedStyle(el, "::after").content)).toBe(
    '" (2 days ago): these numbers may be out of date"',
  );
  // Fresh leagues get no warning.
  await page.goto("/premier-league/", { waitUntil: "networkidle" });
  expect(
    await page
      .locator("[data-stale-message]")
      .first()
      .evaluate((el) => getComputedStyle(el, "::after").content),
  ).toBe("none");
});
