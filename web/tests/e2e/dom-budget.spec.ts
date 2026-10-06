// How many elements each page type has, with and without a favourite team.
// Lighthouse flags large pages ("Optimize DOM size"): a big DOM costs memory
// and makes style and layout work slower. Each budget is an explicit limit
// per page type, so growth is a decision, not an accident. Measured in the
// browser after the page's scripts have run (template contents are not page
// elements and don't count), at 1280px, on the fixed test data.
//
// Measured at the start of Step 3 (commit 069ba57), without / with a favourite:
//   home 382 / 355 · Premier League 2,022 / 2,041 · Bundesliga 2,033 / 2,090 ·
//   matches 1,468 · track record 1,232 · methodology 357 · about 249
// The league pages are above Lighthouse's DOM-size warning level (most of it
// is the finishing-positions heatmap: a cell per team per position, 400 cells
// in a 20-team league). Their budget is the measured count exactly, so they
// can't grow. The other page types have about 5% headroom.
//
// Step 4 brought the league pages down, and their budgets with them:
//   4a, one table row per round of results:  Premier League 2,000 / 2,018 ·
//       Bundesliga 2,007 / 2,061 (much more over a real season);
//   4b, race lines drawn once per chart (<use>) and runs of blank heatmap
//       cells merged: Premier League 1,903 / 1,921 · Bundesliga 1,880 / 1,934;
//   4c, two more fonts preloaded in <head> (so they arrive in time for
//       font-display: optional): +2 on every page, budgets 1,923 and 1,936.
//
// Team pages (Step 3b): 208 (a league without numbers) to 710 (Brentford: the
// trend charts, 3 next and 2 recent matches). The budget is for the largest,
// with about 7% headroom. A team page grows with its match cards (at most 5
// next and 5 recent) and, over a season, with the rows of its "Show the
// numbers" table under the trend (one row per round of results since 4a).
//
// Before the favourites step (commit 108512b): home 253 · league page 1,744
// (Bundesliga 1,760) · matches 1,238 · track record 1,185 · methodology 310 ·
// about 178.
import { expect, test } from "./test.ts";

const BUDGETS: [string, number][] = [
  // Home
  ["/", 400],
  // League pages: no growth at all (the counts after Step 4c)
  ["/premier-league/", 1923],
  ["/bundesliga/", 1936],
  // Matches
  ["/premier-league/matches/", 1540],
  // Team page
  ["/premier-league/brentford/", 760],
  // Other pages
  ["/track-record/", 1290],
  ["/methodology/", 375],
  ["/about/", 260],
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
