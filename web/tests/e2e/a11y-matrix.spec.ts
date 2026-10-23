// The full accessibility matrix. axe-core checks every rule tagged WCAG 2.0,
// 2.1 and 2.2 A and AA. Two overlapping matrices (chosen 23 Oct 2026, 195
// runs; it was 265 with High Contrast on three pages only):
//
//   A: every page    every built page x Matchday (light), Floodlights (dark)
//                    and High Contrast x 3 widths (phone, tablet, desktop).
//                    "System" shows Matchday by day and Floodlights by night,
//                    so these are what most visitors see. Structure problems
//                    (headings, labels, landmarks, reflow) are per page.
//   B: other themes  Tactics Board, Programme, Night Game and Terrace on 3
//                    representative pages (a league page, a matches page, the
//                    track record: together they contain every component)
//                    x phone and desktop. Colour problems are per theme; the
//                    contrast of every theme's colour pairs is also checked
//                    without a browser (tests/unit/themes.test.ts).
//
// axe results rarely depend on width, so 3 widths are enough here; reflow
// and 200% text on real phone sizes are checked by mobile.spec.ts. Each run
// also checks that the page never scrolls sideways and logs no console errors
// (which includes any Content Security Policy violation). Every "Show the
// numbers" table is opened first, so axe checks those too.
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ALL_PAGES, DARK, LIGHT, THEME_IDS, hasSidewaysScroll, openAs } from "./helpers.ts";
import { expect, test } from "./test.ts";

const CONTRAST = "contrast";
const MAIN_THEMES = [LIGHT, DARK, CONTRAST];
const OTHER_THEMES = THEME_IDS.filter((id) => !MAIN_THEMES.includes(id));
const REPRESENTATIVE = ["/premier-league/", "/premier-league/matches/", "/track-record/"];

async function check(page: Page, path: string, theme: string, width: number): Promise<void> {
  const errors = await openAs(page, path, theme, width);
  expect(await page.evaluate(() => document.documentElement.dataset["theme"])).toBe(theme);
  // Only the page's own details (the "Your team" dialog's are inside a closed dialog).
  for (const summary of await page.locator("main details summary").all()) await summary.click();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.help})`)).toEqual([]);
  expect(await hasSidewaysScroll(page), "the page itself must never scroll sideways").toBe(false);
  expect(errors, "console errors (including CSP violations)").toEqual([]);
}

test("the matrix covers every theme", () => {
  expect(OTHER_THEMES).toEqual(["tactics", "programme", "nightgame", "terrace"]);
  expect([...MAIN_THEMES, ...OTHER_THEMES].sort()).toEqual([...THEME_IDS].sort());
});

test.describe("matrix A: every page, light, dark and High Contrast", () => {
  for (const path of ALL_PAGES) {
    for (const theme of MAIN_THEMES) {
      for (const width of [360, 768, 1440]) {
        test(`${path} ${theme} ${width}px`, async ({ page }) => {
          await check(page, path, theme, width);
        });
      }
    }
  }
});

test.describe("matrix B: the other themes on the representative pages", () => {
  for (const path of REPRESENTATIVE) {
    for (const theme of OTHER_THEMES) {
      for (const width of [360, 1440]) {
        test(`${path} ${theme} ${width}px`, async ({ page }) => {
          await check(page, path, theme, width);
        });
      }
    }
  }
});
