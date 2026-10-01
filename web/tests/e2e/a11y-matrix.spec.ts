// The full accessibility matrix (agreed in the plan). axe-core checks every
// rule tagged WCAG 2.0, 2.1 and 2.2 A and AA. Two overlapping matrices, so
// every page and every theme is covered without running every combination:
//
//   A: every theme   3 representative pages (a league page, a matches page,
//                    the track record: together they contain every component)
//                    x all 8 themes x 5 widths. Colour problems are per theme.
//   B: every page    every built page x Matchday (light) and Floodlights (dark)
//                    x 5 widths. Structure problems (headings, labels,
//                    landmarks, reflow) are per page, not per theme.
//
// Combinations already in A are not repeated in B. Each run also checks that
// the page never scrolls sideways and logs no console errors (which includes
// any Content Security Policy violation). Every "Show the numbers" table is
// opened first, so axe checks those too.
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ALL_PAGES, DARK, LIGHT, THEME_IDS, WIDTHS, hasSidewaysScroll, openAs } from "./helpers.ts";
import { expect, test } from "./test.ts";

const REPRESENTATIVE = ["/premier-league/", "/premier-league/matches/", "/track-record/"];

async function check(page: Page, path: string, theme: string, width: number): Promise<void> {
  const errors = await openAs(page, path, theme, width);
  expect(await page.evaluate(() => document.documentElement.dataset["theme"])).toBe(theme);
  for (const summary of await page.locator("details summary").all()) await summary.click();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.help})`)).toEqual([]);
  expect(await hasSidewaysScroll(page), "the page itself must never scroll sideways").toBe(false);
  expect(errors, "console errors (including CSP violations)").toEqual([]);
}

test.describe("matrix A: every theme on the representative pages", () => {
  for (const path of REPRESENTATIVE) {
    for (const theme of THEME_IDS) {
      for (const width of WIDTHS) {
        test(`${path} ${theme} ${width}px`, async ({ page }) => {
          await check(page, path, theme, width);
        });
      }
    }
  }
});

test.describe("matrix B: every page, light and dark", () => {
  for (const path of ALL_PAGES.filter((p) => !REPRESENTATIVE.includes(p))) {
    for (const theme of [LIGHT, DARK]) {
      for (const width of WIDTHS) {
        test(`${path} ${theme} ${width}px`, async ({ page }) => {
          await check(page, path, theme, width);
        });
      }
    }
  }
});
