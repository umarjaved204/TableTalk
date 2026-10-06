// Step 3 pages: the matches pages, the home page, the race charts, and every
// data state. The test site's data (tests/fixtures/make-e2e-data.ts) has one
// league per state and an illustrated lock log with every match status.
import { DARK, LIGHT, openAs } from "./helpers.ts";
import { FILL_SCRIPT } from "../../src/scripts/theme-script.ts";
import { expect, test } from "./test.ts";

// The accessibility runs for these pages are in a11y-matrix.spec.ts.

test.describe("matches page: every status (London time, BST)", () => {
  test.beforeEach(async ({ page }) => {
    await openAs(page, "/premier-league/matches/", DARK, 1440);
  });

  test("upcoming", async ({ page }) => {
    const arsenal = page.locator("#upcoming").locator("[data-match]", { hasText: "Leeds United" }).first();
    await expect(arsenal.locator("[data-status-badge]")).toHaveText("Upcoming");
    await expect(arsenal.locator("[data-status-line]")).toHaveText(
      "Prediction as of 29 Sept, 18:56 · locks at kick-off",
    );
  });

  test("locked: predicted_at from the data", async ({ page }) => {
    const fulham = page.locator("#recent [data-match]", { hasText: "Fulham" });
    await expect(fulham.locator("[data-status-badge]")).toHaveText("Locked");
    await expect(fulham.locator("[data-status-line]")).toHaveText(
      "Prediction made 21 Sept, 05:40 · locked at kick-off · awaiting result",
    );
  });

  test("played: the score next to what was predicted, with what happened marked", async ({ page }) => {
    const chelsea = page.locator("#recent [data-match]", { hasText: "Everton" });
    await expect(chelsea.locator(".clock")).toHaveText(/2–1/);
    await expect(chelsea.locator("[data-status-badge]")).toHaveText("Full time");
    await expect(chelsea.locator("[data-status-line]")).toHaveText("Prediction made 20 Sept, 05:41");
    await expect(chelsea.locator(".happened")).toContainText("Chelsea win");
    await expect(chelsea.locator(".happened")).toContainText("51%");
  });

  test("voided, and the same match back in Upcoming with a note", async ({ page }) => {
    const voided = page.locator("#recent [data-match]", { hasText: "Aston Villa" });
    await expect(voided.locator("[data-status-badge]")).toHaveText("Postponed");
    await expect(voided.locator("[data-status-line]")).toHaveText(
      "Postponed · this prediction won't be scored",
    );
    const again = page
      .locator("#upcoming [data-match]", { hasText: "Aston Villa" })
      .filter({ hasText: "Brentford" });
    await expect(again.locator("[data-status-badge]")).toHaveText("Upcoming");
    await expect(again.locator(".earlier")).toHaveText(
      "An earlier prediction (made 27 Sept, 05:40) was voided: postponed. It won't be scored.",
    );
  });

  test("postponed and re-locked: the current lock, with a note about the voided one", async ({ page }) => {
    const hull = page.locator("#recent [data-match]", { hasText: "Hull City" });
    await expect(hull.locator("[data-status-badge]")).toHaveText("Locked");
    await expect(hull.locator("[data-status-line]")).toContainText("Prediction made 28 Sept, 05:41");
    await expect(hull.locator(".earlier")).toContainText("made 13 Sept, 05:40) was voided: postponed");
  });

  test("not counted: invalid and missed, each in one plain sentence", async ({ page }) => {
    const invalid = page.locator("#recent [data-match]", { hasText: "Newcastle United" });
    await expect(invalid.locator("[data-status-line]")).toHaveText(
      "Not counted: this prediction was made after the match actually kicked off (14 Sept, 17:30), so it is never scored.",
    );
    const missed = page.locator("#recent [data-match]", { hasText: "Crystal Palace" });
    await expect(missed.locator("[data-status-line]")).toHaveText(
      "Not counted: no prediction was made before kick-off, so there is nothing to score.",
    );
    await expect(missed.locator(".bar")).toHaveCount(0); // no prediction to show
  });

  test("Recent says it shows locked matches only, and since when", async ({ page }) => {
    await expect(page.locator("[data-recent-scope]")).toContainText("Only matches with a locked prediction");
    await expect(page.locator("[data-recent-scope]")).toContainText("since 1 Sept, 05:40");
  });

  test("a note that kick-off times can still change", async ({ page }) => {
    await expect(page.locator("#upcoming .note")).toContainText("Kick-off times can still change.");
  });

  test("no chance shown as 0% or 100%", async ({ page }) => {
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/(^|[^\d])(0|100)%/);
  });
});

test.describe("matches that kick off after the page was built", () => {
  test("marked Kicked off in the browser; later matches still upcoming", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-10T12:00:00Z")); // Arsenal v Leeds kicked off at 11:30
    await openAs(page, "/premier-league/matches/", DARK, 1440);
    const arsenal = page.locator("#upcoming [data-match]", { hasText: "Leeds United" }).first();
    await expect(arsenal.locator("[data-status-badge]")).toHaveText("Kicked off");
    await expect(arsenal.locator("[data-status-line]")).toHaveText(
      "Kicked off · the prediction shown was made before kick-off and will be recorded as locked in the next nightly update",
    );
    const chelsea = page.locator("#upcoming [data-match]", { hasText: "Bournemouth" }).first(); // 14:00
    await expect(chelsea.locator("[data-status-badge]")).toHaveText("Upcoming");
  });
});

test.describe("grouping by the visitor's local date", () => {
  test.use({ timezoneId: "Asia/Tokyo" });

  test("a 16:30 UTC Saturday kick-off is under Sunday in Tokyo", async ({ page }) => {
    await openAs(page, "/premier-league/matches/", DARK, 1440);
    const united = page.locator("#upcoming [data-match]", { hasText: "Tottenham Hotspur" }).first();
    await expect(united.locator(".clock")).toHaveText("01:30");
    const heading = united.locator("xpath=preceding-sibling::h3[1]");
    await expect(heading).toHaveText("Sun 11 October");
  });
});

test.describe("phone tabs on the matches page", () => {
  test("Upcoming / Recent", async ({ page }) => {
    await openAs(page, "/premier-league/matches/", LIGHT, 390);
    await expect(page.locator("#upcoming")).toBeVisible();
    await expect(page.locator("#recent")).toBeHidden();
    await page.getByRole("tab", { name: "Recent" }).click();
    await expect(page.locator("#recent")).toBeVisible();
    await expect(page.locator("#upcoming")).toBeHidden();
  });
});

test.describe("home page", () => {
  test("a card per league: title races at a glance, three per race, with bars", async ({ page }) => {
    await openAs(page, "/", LIGHT, 1440);
    const pl = page.locator('[data-league-card="premier_league"]');
    const race = (card: typeof pl, name: string) =>
      card.locator(".race").filter({ has: page.getByRole("heading", { name, exact: true }) });
    const title = race(pl, "Title race");
    // innerText: each name also carries a hidden " (your team)" label.
    await expect(title.locator("li .fav-name")).toHaveText(["Manchester City", "Arsenal", "Liverpool"], {
      useInnerText: true,
    });
    await expect(title.locator("li .chance")).toHaveText(["59%", "34%", "4%"]);
    const relegation = race(pl, "Relegation (18th–20th)");
    await expect(relegation.locator("li")).toHaveCount(3);
    await expect(relegation.locator("li").first()).toContainText("Coventry City");
    await expect(relegation.locator("li .chance").first()).toHaveText("80%");
    // The bar's length is the chance; it is decorative (the number is printed).
    await expect(title.locator("li").first().locator("svg line")).toHaveAttribute("x2", "58.7");
    await expect(title.locator("svg").first()).toHaveAttribute("aria-hidden", "true");
    await expect(pl).toContainText("Results up to 20 Sept");
    // The direct relegation places, in a league with a play-off place too.
    const bl = page.locator('[data-league-card="bundesliga"]');
    await expect(race(bl, "Relegation (17th–18th)").locator("li")).toHaveCount(3);
  });

  test("the bars grow in only when motion is allowed", async ({ page }) => {
    const animation = () =>
      page
        .locator('[data-league-card="premier_league"] svg.bar line')
        .first()
        .evaluate((el) => getComputedStyle(el).animationName);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openAs(page, "/", LIGHT, 1440);
    expect(await animation()).toBe("none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    expect(await animation()).not.toBe("none");
  });

  test("last update, simulations and the track record line, linking to its page", async ({ page }) => {
    await openAs(page, "/", LIGHT, 1440);
    await expect(page.locator(".facts")).toContainText("Last update 29 Sept, 18:56");
    await expect(page.locator(".facts")).toContainText("10,000 simulated seasons per league");
    await expect(page.locator(".track-record")).toContainText(
      "183 matches scored. Against base rates: model better (log loss difference −0.072 ± 0.044).",
    );
    await page.getByRole("link", { name: "How the predictions have done" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Track record");
  });

  test("each data state has its own message", async ({ page }) => {
    await openAs(page, "/", LIGHT, 1440);
    await expect(page.locator('[data-league-card="la_liga"]')).toContainText(
      "its published file couldn't be read",
    );
    await expect(page.locator('[data-league-card="serie_a"]')).toContainText("Numbers hidden");
    const ligue1 = page.locator('[data-league-card="ligue_1"]');
    await expect(ligue1).toContainText("Provisional");
    await expect(ligue1).toContainText("Last night's update failed for this league");
  });

  test("stale: more than 30 hours after the update, the page says so", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-01T06:00:00Z")); // 36 hours after
    await openAs(page, "/", LIGHT, 1440);
    // The warning is CSS set before the first paint (staleCss): the line's
    // ::after text, and the line shown on the home cards.
    const note = (selector: string) =>
      page.locator(selector).evaluate((el) => getComputedStyle(el, "::after").content);
    expect(await note(".facts [data-stale-message]")).toBe(
      '" (36 hours ago): these numbers may be out of date"',
    );
    const card = page.locator('[data-league-card="premier_league"] [data-stale-message]');
    await expect(card).toBeVisible();
    await expect(card).toContainText("Updated");
    expect(await note('[data-league-card="premier_league"] [data-stale-message]')).toContain("36 hours ago");
  });

  test("not stale at FIXTURE_NOW", async ({ page }) => {
    await openAs(page, "/", LIGHT, 1440);
    await expect(page.locator('[data-league-card="premier_league"] [data-stale-message]')).toBeHidden();
  });
});

test.describe("how the race has moved", () => {
  test("Premier League: title, relegation and points charts, each with a table", async ({ page }) => {
    await openAs(page, "/premier-league/", LIGHT, 1440);
    const race = page.locator("section.race");
    await expect(race.getByRole("heading", { level: 3 })).toHaveText([
      "Title chances",
      "Relegation chances (18th–20th)",
      "Projected points",
    ]);
    const title = race.locator("figure").first();
    // innerText: each name also carries a hidden " (your team)" label, shown only for a favourite.
    await expect(title.locator(".panel-head .team")).toHaveText(["Manchester City", "Arsenal"], {
      useInnerText: true,
    });
    await title.locator("summary").click();
    // 6 runs, one row per round of results (the last two share results up to
    // 20 Sep, so the newer one is kept), newest first; one column per team.
    await expect(title.locator("tbody tr")).toHaveCount(5);
    await expect(title.locator("tbody tr").first()).toContainText("59%");
    await expect(title.locator("thead th")).toHaveText([
      "Updated",
      "Results up to",
      "Manchester City",
      "Arsenal",
    ]);
  });

  test("the chart is SVG in the HTML: no chart script", async ({ page }) => {
    await openAs(page, "/premier-league/", LIGHT, 1440);
    expect(await page.locator("section.race svg path.line").count()).toBeGreaterThan(0);
    // The only scripts are the one-line favourite-team fill (one per chart),
    // which copies in a pre-built panel; nothing draws the charts.
    const scripts = await page.locator("section.race script").allTextContents();
    expect(scripts.every((s) => s === FILL_SCRIPT)).toBe(true);
  });

  test("Bundesliga (six zones): relegation is 17th–18th, play-off place named as not included", async ({
    page,
  }) => {
    await openAs(page, "/bundesliga/", LIGHT, 1440);
    await expect(page.locator("#race-relegation-heading")).toHaveText("Relegation chances (17th–18th)");
    await expect(page.locator("section.race")).toContainText("The play-off place (16th) is not included.");
  });

  test("Ligue 1 has no history yet: too early to show a trend", async ({ page }) => {
    await openAs(page, "/ligue-1/", LIGHT, 1440);
    await expect(page.locator("[data-race-too-early]")).toContainText("Too early to show a trend.");
    await expect(page.locator("section.race svg")).toHaveCount(0);
  });
});

test.describe("data states on league pages", () => {
  test("La Liga: unavailable (its file couldn't be read)", async ({ page }) => {
    await openAs(page, "/la-liga/", LIGHT, 1440);
    await expect(page.locator("main")).toContainText("The published forecast file couldn't be read");
  });

  test("Serie A: numbers hidden (newer format), on both pages", async ({ page }) => {
    for (const path of ["/serie-a/", "/serie-a/matches/"]) {
      await openAs(page, path, LIGHT, 1440);
      await expect(page.locator("main")).toContainText("This league's numbers are hidden");
      await expect(page.locator("[data-match]")).toHaveCount(0);
    }
  });

  test("Ligue 1: older numbers kept, provisional, with the notice", async ({ page }) => {
    await openAs(page, "/ligue-1/matches/", LIGHT, 1440);
    const main = page.locator("main");
    await expect(main).toContainText("Last night's update failed for this league");
    await expect(main).toContainText("Provisional");
    await expect(main).toContainText("Illustrated notice: an awarded result is waiting for confirmation");
  });
});

test.describe("track record page (mature illustrated record)", () => {
  test.beforeEach(async ({ page }) => {
    await openAs(page, "/track-record/", LIGHT, 1440);
  });

  test("counts and when recording started", async ({ page }) => {
    await expect(page.locator(".counts")).toContainText("Locked predictions189");
    await expect(page.locator(".counts")).toContainText("Scored183");
    await expect(page.locator("main")).toContainText("Recording since 1 Sept, 05:40");
  });

  test("comparisons: difference ± 95% interval and the verdict, never 'beats'", async ({ page }) => {
    const base = page.locator('[data-comparison="base"] tbody tr').first();
    await expect(base).toContainText("All leagues");
    await expect(base).toContainText("−0.072 ± 0.044");
    await expect(base).toContainText("model better");
    const market = page.locator('[data-comparison="market"] tbody tr').first();
    await expect(market).toContainText("+0.019 ± 0.036");
    await expect(market).toContainText("no detectable difference");
    expect(await page.locator("main").innerText()).not.toMatch(/\bbeat/i);
  });

  test("the market sample is too small to judge, and the page says so", async ({ page }) => {
    await expect(page.locator(".sample")).toHaveText(
      "Against the market: 150 matches so far, too few to judge: roughly 1,381 are needed to detect a gap the size the backtest found (0.02 in log loss).",
    );
  });

  test("calibration chart shown (enough matches), with its table", async ({ page }) => {
    await expect(page.locator(".calibration-chart svg")).toHaveCount(3);
    await expect(page.locator("[data-calibration-table] tbody tr")).toHaveCount(7);
    await expect(page.locator("[data-calibration-chart-hidden]")).toHaveCount(0);
  });

  test("the 50 most recent scored matches, newest first", async ({ page }) => {
    await expect(page.locator("main")).toContainText("The 50 most recent of 183, newest first.");
    await expect(page.locator("[data-scored-table] tbody tr")).toHaveCount(50);
  });

  test("the header marks the current page", async ({ page }) => {
    await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveText("Track record");
  });
});

test.describe("methodology and about", () => {
  test("backtest table: one row per league, differences with intervals, source commit named", async ({
    page,
  }) => {
    await openAs(page, "/methodology/", LIGHT, 1440);
    const rows = page.locator("[data-backtests] tbody tr");
    await expect(rows).toHaveCount(5);
    await expect(rows.first()).toContainText("Premier League");
    await expect(rows.first()).toContainText("9.4% lower*");
    await expect(rows.first()).toContainText("+0.020 ± 0.007");
    await expect(page.getByRole("link", { name: "README at commit bcca0a5" })).toHaveAttribute(
      "href",
      /\/blob\/bcca0a5\/README\.md$/,
    );
    expect(await page.locator("main").innerText()).not.toMatch(/\bbeat/i);
  });

  test("about lists the data sources the snapshots name", async ({ page }) => {
    await openAs(page, "/about/", LIGHT, 1440);
    await expect(page.locator("[data-sources] li")).toHaveCount(3);
    await expect(page.locator("[data-sources]")).toContainText(
      "Football-Data.org API: results and the fixture list",
    );
  });
});
