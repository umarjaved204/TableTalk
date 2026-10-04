// How many elements each page type has, with and without a favourite team.
// Lighthouse flags large pages ("Optimize DOM size"): a big DOM costs memory
// and makes style and layout work slower. These budgets are the measured
// sizes after the favourites step plus a little headroom, so growth is a
// decision, not an accident. Measured in the browser after the page's
// scripts have run (template contents are not page elements and don't count).
//
// Before the favourites step (commit 108512b, same test data, 1280px):
//   /  253 · league page 1,744 (Bundesliga 1,760) · matches 1,238 ·
//   track record 1,185 · methodology 310 · about 178
// The league pages were already above Lighthouse's older 1,400-element
// warning level; most of that is the finishing-positions heatmap (a cell per
// team per position: 400 cells in a 20-team league).
import { expect, test } from "./test.ts";

const BUDGETS: [string, number][] = [
  ["/", 480],
  ["/premier-league/", 2100],
  ["/bundesliga/", 2150],
  ["/premier-league/matches/", 1550],
  ["/track-record/", 1300],
  ["/methodology/", 400],
  ["/about/", 300],
];
const FAVOURITE: Record<string, string> = { "/bundesliga/": "mainz-05" };

for (const [path, budget] of BUDGETS) {
  for (const withFavourite of [false, true]) {
    test(`${path} ${withFavourite ? "with" : "without"} a favourite: at most ${budget} elements`, async ({
      page,
    }) => {
      if (withFavourite) {
        const team = FAVOURITE[path] ?? "arsenal";
        await page.addInitScript((slug) => {
          localStorage.setItem("tabletalk-favourite", JSON.stringify({ v: 1, team: slug }));
        }, team);
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(path, { waitUntil: "networkidle" });
      const count = await page.evaluate(() => document.getElementsByTagName("*").length);
      test.info().annotations.push({ type: "elements", description: String(count) });
      expect(count).toBeLessThanOrEqual(budget);
    });
  }
}
