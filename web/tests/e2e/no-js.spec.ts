// The site without JavaScript. Controls that need it (the phone tabs, the
// table's Short/Full switch and chance picker) are shown only when the theme
// script has marked the page with data-js. Without JavaScript they must stay
// hidden, and every section must be shown in full, with the numbers.
import { expect, test } from "./test.ts";

test.use({ javaScriptEnabled: false });

for (const width of [390, 1440]) {
  test(`league page at ${width}px without JavaScript: every section, no dead controls`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/premier-league/");
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-js"))).toBe(false);
    await expect(page.locator("[data-tablist]")).toBeHidden();
    await expect(page.locator("[data-controls]")).toBeHidden();
    for (const id of ["#table", "#matches", "#positions"]) await expect(page.locator(id)).toBeVisible();
    await expect(page.locator("[data-league-table] td.chance").first()).toBeVisible();
  });
}

test("matches page on a phone without JavaScript: both lists, no tabs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/premier-league/matches/");
  await expect(page.locator("[data-tablist]")).toBeHidden();
  await expect(page.locator("#upcoming")).toBeVisible();
  await expect(page.locator("#recent")).toBeVisible();
});
