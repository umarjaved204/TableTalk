// Team pages (/<league>/<team>/), in each data state of the test site.
// Accessibility, keyboard and sideways scrolling are checked for TEAM_PAGES
// by a11y-matrix.spec.ts and keyboard.spec.ts; element counts by dom-budget.spec.ts.
import { expect, test } from "./test.ts";

test.describe("a team page with numbers (Premier League, with history)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/premier-league/brentford/", { waitUntil: "networkidle" });
  });

  test("title, description and Open Graph are the team's", async ({ page }) => {
    await expect(page).toHaveTitle("Brentford 2026-27 predictions · TableTalk");
    const meta = (selector: string) => page.locator(selector).getAttribute("content");
    const description = await meta('meta[name="description"]');
    expect(description).toMatch(
      /^Brentford in the Premier League 2026-27: \d+(st|nd|rd|th) with \d+ points from \d+ matches, projected \d+ points\. Chances: title \S+, top four \S+, relegation \S+\. Updated nightly\.$/,
    );
    expect(await meta('meta[property="og:title"]')).toBe("Brentford 2026-27 predictions · TableTalk");
    expect(await meta('meta[property="og:description"]')).toBe(description);
  });

  test("breadcrumb: a navigation landmark, the last link is the current page", async ({ page }) => {
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link")).toHaveText(["Home", "Premier League", "Brentford"]);
    await expect(crumbs.getByRole("link", { name: "Brentford" })).toHaveAttribute("aria-current", "page");
    await expect(crumbs.getByRole("link", { name: "Premier League" })).toHaveAttribute(
      "href",
      "/premier-league/",
    );
    await expect(crumbs.locator("[aria-current]")).toHaveCount(1);
  });

  test("record, Proj. pts with range, and every zone's chance", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Brentford", exact: true })).toBeVisible();
    const now = page.getByRole("region", { name: "Now and projected" });
    await expect(now.locator("dd").nth(5)).toHaveText(/^\d+ \(range \d+–\d+\)$/);
    await expect(now.getByRole("list", { name: "Chances" }).getByRole("listitem")).toHaveCount(5);
    await expect(now.getByRole("list", { name: "Chances" })).toContainText("Relegation (18th–20th)");
  });

  test("finishing positions: a bar per position, 'Most likely' matches the table", async ({ page }) => {
    const chart = page.getByRole("figure", { name: "Finishing position" });
    await expect(chart.locator("rect.bar")).toHaveCount(20);
    await expect(chart.locator("rect.bar.likely")).toHaveCount(1);
    await chart.getByText("Show the numbers").click();
    const rows = chart.locator("tbody tr");
    await expect(rows).toHaveCount(20);
    const cells = await rows.evaluateAll((trs) =>
      trs.map((tr) => [
        tr.querySelector("th")!.textContent!.trim(),
        tr.querySelector("td")!.textContent!.trim(),
      ]),
    );
    const value = (text: string) =>
      text.startsWith("<") ? 0 : text.startsWith(">") ? 100 : parseInt(text, 10);
    const best = cells.reduce((a, b) => (value(b[1]!) > value(a[1]!) ? b : a));
    await expect(chart.locator("p.likely")).toHaveText(`Most likely: ${best[0]} (${best[1]})`);
    // Zone bands, and the table names each position's zone.
    await expect(chart.locator("rect.band")).toHaveCount(4);
    await expect(rows.first().locator("td").nth(1)).toHaveText("Title");
    await expect(rows.last().locator("td").nth(1)).toHaveText("Relegation");
  });

  test("chances over time: a panel per zone and projected points, with the numbers", async ({ page }) => {
    const trend = page.getByRole("region", { name: "Chances over time" });
    await expect(trend.locator("[data-race-too-early]")).toHaveCount(0);
    await expect(trend.locator(".panel")).toHaveCount(4); // title, top four, relegation, projected points
    await trend.getByText("Show the numbers").click();
    await expect(trend.locator("thead th")).toHaveText([
      "Updated",
      "Results up to",
      "Title",
      "Top four",
      "Relegation",
      "Proj. pts",
    ]);
  });

  test("next and recent matches are Brentford's, as match cards", async ({ page }) => {
    for (const name of ["Next matches", "Recent matches"]) {
      const cards = page.getByRole("region", { name }).locator("[data-match]");
      expect(await cards.count(), name).toBeGreaterThan(0);
      expect(await cards.count(), name).toBeLessThanOrEqual(5);
      for (const teams of await cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-teams")))) {
        expect(teams?.split(" ")).toContain("brentford");
      }
    }
  });
});

test("too early, provisional and older numbers (Ligue 1)", async ({ page }) => {
  await page.goto("/ligue-1/monaco/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "Monaco", exact: true })).toBeVisible();
  await expect(page.locator("[data-race-too-early]")).toContainText("Too early to show a trend");
  await expect(page.getByText("Provisional", { exact: true })).toBeVisible();
  await expect(page.getByText("Last night's update failed for this league")).toBeVisible();
  // An 18-team league: 18 bars, and the play-off place has its own band.
  await expect(page.locator("rect.bar")).toHaveCount(18);
  await expect(page.locator(".key")).toContainText("Play-off place (16th)");
});

for (const [path, name, message] of [
  ["/la-liga/atletico-madrid/", "Atlético Madrid", "We don't have a forecast for La Liga right now"],
  ["/serie-a/inter-milan/", "Inter Milan", "This league's numbers are hidden"],
] as const) {
  test(`${path}: the page exists without numbers, and says why`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();
    await expect(page.locator("rect.bar")).toHaveCount(0);
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    await expect(page).toHaveTitle(`${name} predictions · TableTalk`);
  });
}

test("a team that isn't covered has no page (404)", async ({ page }) => {
  const response = await page.goto("/premier-league/not-a-team/");
  expect(response?.status()).toBe(404);
});
