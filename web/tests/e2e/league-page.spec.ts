import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DARK, THEME_IDS, WIDTHS, hasSidewaysScroll, openAs } from "./helpers.ts";

const PAGE = "/premier-league/";

// Step 2 has one real page, so it gets the full matrix: every theme at every
// width. (The Step 5 matrix for all pages is described in tests/README.md.)
test.describe("accessibility matrix: every theme x every width", () => {
  for (const theme of THEME_IDS) {
    for (const width of WIDTHS) {
      test(`${theme} at ${width}px`, async ({ page }) => {
        const errors = await openAs(page, PAGE, theme, width);
        expect(await page.evaluate(() => document.documentElement.dataset["theme"])).toBe(theme);

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        const summary = results.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.help})`);
        expect(summary).toEqual([]);

        expect(await hasSidewaysScroll(page), "the page itself must never scroll sideways").toBe(false);
        expect(errors, "console errors (including CSP violations)").toEqual([]);
      });
    }
  }
});

test("Barlow Condensed digits are equal width when rendered (tabular figures)", async ({ page }) => {
  await openAs(page, PAGE, DARK, 1024);
  const widths = await page.evaluate(async () => {
    await document.fonts.load('700 40px "Barlow Condensed"');
    const measure = (numeric: string) =>
      [..."0123456789"].map((digit) => {
        const span = document.createElement("span");
        span.textContent = digit.repeat(10);
        span.style.cssText = `font: 700 40px "Barlow Condensed"; font-variant-numeric: ${numeric}; position: absolute;`;
        document.body.append(span);
        const width = span.getBoundingClientRect().width;
        span.remove();
        return Math.round(width * 100) / 100;
      });
    return {
      loaded: document.fonts.check('700 40px "Barlow Condensed"'),
      tabular: measure("tabular-nums"),
      proportional: measure("proportional-nums"),
      // What the site actually applies, on every element that shows digits.
      notTabular: [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && /\d/.test(n.textContent ?? "")))
        .filter((el) => getComputedStyle(el).fontVariantNumeric !== "tabular-nums")
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}: ${el.textContent?.trim().slice(0, 20)}`),
    };
  });
  expect(widths.loaded).toBe(true);
  expect(new Set(widths.tabular).size, `tabular widths ${widths.tabular.join(", ")}`).toBe(1);
  expect(
    new Set(widths.proportional).size,
    "proportional digits differ (so the test would notice)",
  ).toBeGreaterThan(1);
  expect(widths.notTabular).toEqual([]);
});

test("kick-off times are shown in the visitor's time zone", async ({ page }) => {
  await openAs(page, PAGE, DARK, 1024);
  // Arsenal v Leeds United kicks off 11:30 UTC on 10 Oct: 12:30 in London (BST).
  const card = page.locator("[data-match]", { hasText: "Leeds United" }).first();
  await expect(card.locator(".clock")).toHaveText("12:30");
  await expect(page.locator("[data-tz-label]").first()).toHaveText("your time zone (BST)");
});

test.describe("theme picker", () => {
  test("keyboard arrows change the theme, and the choice survives a reload with no flash", async ({
    page,
  }) => {
    await openAs(page, PAGE, DARK, 390);
    await page.getByRole("button", { name: "Appearance" }).click();
    const dialog = page.getByRole("dialog", { name: "Appearance" });
    await expect(dialog).toBeVisible();

    const checked = dialog.getByRole("radio", { checked: true });
    await expect(checked).toHaveAccessibleName(/Floodlights/);
    await checked.focus();
    await page.keyboard.press("ArrowDown");
    await expect(dialog.getByRole("radio", { checked: true })).toHaveAccessibleName(/Matchday/);
    expect(await page.evaluate(() => document.documentElement.dataset["theme"])).toBe("matchday");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.reload();
    const state = await page.evaluate(() => ({
      theme: document.documentElement.dataset["theme"],
      // The theme script must be the first thing in <body>, before any content.
      firstInBody: document.body.firstElementChild?.tagName,
    }));
    expect(state).toEqual({ theme: "matchday", firstInBody: "SCRIPT" });
  });

  test("System follows the device setting", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await openAs(page, PAGE, "system", 1024);
    expect(await page.evaluate(() => document.documentElement.dataset["theme"])).toBe("floodlights");
    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset["theme"])).toBe("matchday");
    await page.emulateMedia({ contrast: "more" });
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset["theme"])).toBe("contrast");
  });
});

test.describe("league table views", () => {
  const visibleHeaders = (page: import("@playwright/test").Page) =>
    page.locator("[data-league-table] thead th:visible").allInnerTexts();

  test("phone: Short view shows position, team, points and one chosen chance", async ({ page }) => {
    await openAs(page, PAGE, DARK, 360);
    expect(await visibleHeaders(page)).toEqual(["#", "TEAM", "PTS", "TITLE"]);

    await page.getByLabel("Chance shown").selectOption({ label: "Relegation to the Championship" });
    expect(await visibleHeaders(page)).toEqual(["#", "TEAM", "PTS", "DOWN"]);

    await page.getByText("Full", { exact: true }).click();
    expect((await visibleHeaders(page)).length).toBeGreaterThan(10);
    expect(await hasSidewaysScroll(page)).toBe(false); // the table scrolls inside its own box
  });

  test("desktop: Full view by default", async ({ page }) => {
    await openAs(page, PAGE, DARK, 1440);
    expect((await visibleHeaders(page)).length).toBeGreaterThan(10);
  });

  test("no chance is ever shown as 0% or 100%", async ({ page }) => {
    await openAs(page, PAGE, DARK, 1440);
    const cells = await page.locator("[data-league-table] td.chance").allInnerTexts();
    expect(cells.length).toBe(20 * 5);
    expect(cells.filter((c) => c === "0%" || c === "100%")).toEqual([]);
  });
});

test.describe("phone tabs", () => {
  test("Table / Matches / Positions with arrow keys", async ({ page }) => {
    await openAs(page, PAGE, DARK, 390);
    const tabs = page.getByRole("tablist");
    await expect(tabs).toBeVisible();
    await expect(page.locator("#table")).toBeVisible();
    await expect(page.locator("#matches")).toBeHidden();

    await page.getByRole("tab", { name: "Table" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Matches" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Matches" })).toBeFocused();
    await expect(page.locator("#matches")).toBeVisible();
    await expect(page.locator("#table")).toBeHidden();
  });

  test("wide screens show every section, no tabs", async ({ page }) => {
    await openAs(page, PAGE, DARK, 1024);
    await expect(page.getByRole("tablist")).toHaveCount(0);
    for (const id of ["#table", "#matches", "#positions"]) await expect(page.locator(id)).toBeVisible();
  });
});
