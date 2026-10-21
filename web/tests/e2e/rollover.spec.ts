// A new season: three Premier League teams relegated, three promoted (and one
// change in the Bundesliga). Built from tests/fixtures/make-rollover-data.ts
// by playwright.rollover.config.ts (npm run test:rollover).
//   - a favourite relegated last season: said plainly, with a way to pick another;
//   - a favourite promoted this season: works like any other team;
//   - personal links to relegated teams change nothing; to promoted teams, they work;
//   - the picker lists this season's teams only;
//   - last season's teams that left keep a stub page ("not covered this
//     season", noindex) that can be left with the site's own links; promoted
//     teams get a real team page.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { stars } from "./helpers.ts";

const KEY = "tabletalk-favourite";

test("a favourite that was relegated: 'isn't in the leagues we cover this season', and the choice is kept until changed", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem(
        key,
        JSON.stringify({ v: 1, team: "hull-city", name: "Hull City", league: "premier_league" }),
      );
    }
  }, KEY);
  await page.goto("/", { waitUntil: "networkidle" });
  const message = page.getByRole("region", { name: "Hull City isn't in the leagues we cover this season" });
  await expect(message).toBeVisible();
  await expect(message).toContainText("It was in the Premier League when you picked it.");
  // Nothing is starred anywhere, and the stored choice is untouched.
  await page.goto("/premier-league/", { waitUntil: "networkidle" });
  expect(await stars(page.locator("body"))).toBe(0);
  expect(JSON.parse((await page.evaluate((key) => localStorage.getItem(key), KEY))!).team).toBe("hull-city");
  // Picking another team replaces it.
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Pick another team" }).click();
  await page.getByRole("dialog").getByLabel("Choose a team").selectOption("burnley");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("article", { name: "Burnley" })).toBeVisible();
});

test("a promoted team works like any other: card, star, league first", async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({ v: 1, team: "fortuna-dusseldorf", name: "Fortuna Düsseldorf", league: "bundesliga" }),
    );
  }, KEY);
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("article", { name: "Fortuna Düsseldorf" })).toContainText("Bundesliga");
  await page.goto("/bundesliga/", { waitUntil: "networkidle" });
  expect(await stars(page.locator('[data-league-table] tr[data-team="fortuna-dusseldorf"]'))).toBe(1);
  await expect(page.getByText("Too early to show a trend.")).toBeVisible();
});

test("personal links: a relegated team's changes nothing; a promoted team's works", async ({ page }) => {
  await page.goto("/?team=coventry-city", { waitUntil: "networkidle" });
  await expect(page.getByText("This link's team isn't one we cover this season.")).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBeNull();
  await page.goto("/?team=leicester-city", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Make it my team" }).click();
  await expect(page.getByRole("article", { name: "Leicester City" })).toBeVisible();
});

test("the picker lists this season's teams only", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator("[data-open-favourite]").click();
  const options = await page
    .getByRole("dialog")
    .getByLabel("Choose a team")
    .locator("option")
    .allTextContents();
  for (const team of ["Burnley", "Leicester City", "Sheffield United", "Fortuna Düsseldorf"])
    expect(options).toContain(team);
  for (const team of ["Coventry City", "Ipswich Town", "Hull City", "Hamburger SV"])
    expect(options).not.toContain(team);
});

/** Last season's teams that left: one stub page each, under last season's league. */
const STUBS = [
  ["/premier-league/coventry-city/", "Coventry City", "the Premier League", "Premier League"],
  ["/premier-league/hull-city/", "Hull City", "the Premier League", "Premier League"],
  ["/premier-league/ipswich-town/", "Ipswich Town", "the Premier League", "Premier League"],
  ["/bundesliga/hamburger-sv/", "Hamburger SV", "the Bundesliga", "Bundesliga"],
] as const;

for (const [path, name, inSentence, league] of STUBS) {
  test(`stub page for ${name}: not covered this season, noindex, links back into the site`, async ({
    page,
  }) => {
    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(`${name}: not covered this season · TableTalk`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
    await expect(page.getByText(`${name} isn't in the leagues we cover this season`)).toBeVisible();
    await expect(page.getByText(`It was in ${inSentence} in 2026-27.`)).toBeVisible();
    // No numbers: this season has none for the team.
    await expect(page.locator("rect.bar")).toHaveCount(0);
    // Not in the main test site, so the accessibility matrix doesn't see it.
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    // The way out without a back button: breadcrumb, header brand, links.
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link")).toHaveText(["Home", league, name]);
    await expect(crumbs.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "TableTalk" })).toHaveAttribute("href", "/");
    await page.getByRole("link", { name: `${league} table and chances` }).click();
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(`^${league}`) })).toBeVisible();
  });
}

test("promoted teams get real team pages; teams still covered get no stub", async ({ page }) => {
  await page.goto("/premier-league/burnley/", { waitUntil: "networkidle" });
  await expect(page).toHaveTitle("Burnley 2027-28 predictions · TableTalk");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await page.goto("/premier-league/arsenal/", { waitUntil: "networkidle" });
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.getByText("isn't in the leagues we cover")).toHaveCount(0);
  // A team in neither season has no page.
  const response = await page.goto("/premier-league/not-a-team/");
  expect(response?.status()).toBe(404);
});
