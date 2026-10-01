// Fixes from the review of the built site (after Step 4): home card rows,
// the league page's tab names, and the trimmed fonts.
import { LEAGUES } from "../../src/data/leagues.ts";
import { DARK, LIGHT, openAs } from "./helpers.ts";
import { expect, test } from "./test.ts";

test.describe("home page: five cards, never one left alone on a row", () => {
  /** How many cards sit on each row, top to bottom. */
  async function rowSizes(page: import("@playwright/test").Page): Promise<number[]> {
    const tops = await page
      .locator("[data-league-card]")
      .evaluateAll((cards) => cards.map((c) => Math.round(c.getBoundingClientRect().top)));
    const rows = new Map<number, number>();
    for (const top of tops) rows.set(top, (rows.get(top) ?? 0) + 1);
    return [...rows.values()];
  }

  for (const [width, expected] of [
    [1440, [5]],
    [1280, [5]],
    [1024, [3, 2]],
    [768, [2, 2, 1]],
    [390, [1, 1, 1, 1, 1]],
  ] as const) {
    test(`${width}px: rows of ${expected.join(" + ")}`, async ({ page }) => {
      await openAs(page, "/", LIGHT, width);
      expect(await rowSizes(page)).toEqual(expected);
    });
  }

  test("768px: the fifth card spans the full width", async ({ page }) => {
    await openAs(page, "/", LIGHT, 768);
    const cards = page.locator("[data-league-card]");
    const first = (await cards.nth(0).boundingBox())!;
    const fifth = (await cards.nth(4).boundingBox())!;
    expect(fifth.width).toBeGreaterThan(first.width * 1.9);
  });
});

test.describe("league page tabs on phones", () => {
  for (const league of LEAGUES) {
    test(`${league.name}: Table / Next matches / Positions, and the "All matches" link`, async ({ page }) => {
      await openAs(page, `/${league.slug}/`, DARK, 390);
      const tabs = page.getByRole("tab");
      if ((await tabs.count()) === 0) {
        // A league without numbers (a test-site data state) has no tabs.
        await expect(page.locator(".notice")).toBeVisible();
        return;
      }
      await expect(tabs).toHaveText(["Table", "Next matches", "Positions"]);
      await expect(page.locator(".league-nav a")).toHaveText(["Table and chances", "All matches"]);
    });
  }
});

test.describe("fonts", () => {
  test("only Latin and Latin Extended WOFF2 files are requested", async ({ page }) => {
    const fonts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "font") fonts.push(new URL(request.url()).pathname);
    });
    await openAs(page, "/bundesliga/", LIGHT, 1440);
    expect(fonts.length).toBeGreaterThan(0);
    for (const path of fonts) expect(path).toMatch(/-(latin|latin-ext)-.*\.woff2$/);
  });

  test("ö, é and ł render in the site's own fonts, not a fallback", async ({ page }) => {
    await openAs(page, "/", LIGHT, 1024);
    const loaded = await page.evaluate(async () => {
      const result: Record<string, number> = {};
      const families = [
        ["Source Sans 3 Variable", 400],
        ["Barlow Condensed", 700],
      ] as const;
      for (const [family, weight] of families) {
        for (const text of ["Mönchengladbach", "Alavés", "Ołeksandr"]) {
          // load() returns the font faces that cover these characters (none = a fallback font).
          const faces = await document.fonts.load(`${weight} 20px "${family}"`, text);
          result[`${family}: ${text}`] = faces.length;
        }
      }
      return result;
    });
    for (const [what, faces] of Object.entries(loaded)) expect(faces, what).toBeGreaterThan(0);
    // ł needs the Latin Extended file: check it is the face that loaded.
    const extLoaded = await page.evaluate(async () => {
      const faces = await document.fonts.load('400 20px "Source Sans 3 Variable"', "ł");
      return faces.map((f) => f.unicodeRange);
    });
    expect(extLoaded.join(" ")).toContain("U+100-2BA");
  });
});
