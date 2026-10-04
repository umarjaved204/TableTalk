// A new season: three Premier League teams relegated, three promoted (and one
// change in the Bundesliga). Built from tests/fixtures/make-rollover-data.ts
// by playwright.rollover.config.ts (npm run test:rollover).
//   - a favourite relegated last season: said plainly, with a way to pick another;
//   - a favourite promoted this season: works like any other team;
//   - personal links to relegated teams change nothing; to promoted teams, they work;
//   - the picker lists this season's teams only.
// Team pages (and stub pages for last season's teams) are added in Step 3.
import { expect, test } from "@playwright/test";

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
  await expect(page.locator(".fav-star:visible")).toHaveCount(0);
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
  await expect(
    page.locator('[data-league-table] tr[data-team="fortuna-dusseldorf"] .fav-star'),
  ).toBeVisible();
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
