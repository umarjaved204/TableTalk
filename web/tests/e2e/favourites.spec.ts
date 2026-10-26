// Favourite team, in a real browser (desktop Chrome project): every state,
// the picker by keyboard, an old ?team= link changing nothing, no layout
// shift, blocked storage, the matches filter, accessibility (axe) in light and dark, and graceful fallbacks.
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { DARK, LIGHT, hasSidewaysScroll, stars } from "./helpers.ts";
import { expect, test } from "./test.ts";

const KEY = "tabletalk-favourite";
const saved = (team: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 1, team, name: "Stored name", league: "premier_league", ...extra });

/** Seed localStorage once per tab (not on reloads, so a choice made on the page survives a reload). */
async function seed(page: Page, values: Record<string, string | null>): Promise<void> {
  await page.addInitScript((entries) => {
    try {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      for (const [key, value] of Object.entries(entries)) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
    } catch {
      // ignore
    }
  }, values);
}

/** Total layout shift after load (shifts right after input don't count, as in CLS). */
async function watchShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __shift: number };
    w.__shift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
        sources: { node?: Node; previousRect: DOMRect; currentRect: DOMRect }[];
      }[]) {
        if (entry.hadRecentInput) continue;
        w.__shift += entry.value;
        // Something moved up or down (what a late block would do), not just
        // sideways (text re-flowing in its line when the web font arrives).
        if (entry.sources.some((s) => Math.abs(s.previousRect.y - s.currentRect.y) > 1)) {
          const v = w as unknown as { __vshift?: number };
          v.__vshift = (v.__vshift ?? 0) + entry.value;
        }
        // What moved, for the failure message.
        const moved = ((w as unknown as { __moved?: string[] }).__moved ??= []);
        for (const s of entry.sources) {
          const name = s.node instanceof Element ? s.node.className || s.node.tagName : s.node?.nodeName;
          moved.push(
            `${name} ${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)} (${entry.value.toFixed(3)})`,
          );
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}
// Layout shift allowed after load. Favourite blocks are in place at the first
// paint, so anything moving up or down must stay tiny (a fifth of the site's
// 0.1 budget). Since Step 4c a late web font no longer swaps in (font-display:
// optional) and the out-of-date warning is set before the first paint, so the
// only other movement is times rewritten in the visitor's zone (sideways,
// about 0.002). All movement together stays under a fifth of the budget too.
const MAX_VERTICAL_SHIFT = 0.02;
const MAX_TOTAL_SHIFT = 0.02;

async function expectNoShift(page: Page): Promise<void> {
  const { total, vertical, moved } = await page.evaluate(() => {
    const w = window as unknown as { __shift: number; __vshift?: number; __moved?: string[] };
    return { total: w.__shift, vertical: w.__vshift ?? 0, moved: w.__moved ?? [] };
  });
  if (moved.length > 0) test.info().annotations.push({ type: "moved", description: moved.join("; ") });
  expect(vertical, "shift that moved something up or down").toBeLessThan(MAX_VERTICAL_SHIFT);
  expect(total, "all shift").toBeLessThan(MAX_TOTAL_SHIFT);
}

const slot = (page: Page) => page.locator(".your-team-slot");
const stored = (page: Page) => page.evaluate((key) => localStorage.getItem(key), KEY);

async function open(page: Page, path: string, width = 1280): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path, { waitUntil: "networkidle" });
}

const dialogOf = (page: Page) => page.getByRole("dialog", { name: "Your team" });
const pressedLeague = (page: Page) =>
  dialogOf(page).locator('.league[aria-pressed="true"]').allTextContents();
/** The team radios a visitor can see (the shown league's). */
const shownTeams = (page: Page) => dialogOf(page).locator("fieldset:not([hidden]) input[type=radio]");

/** Press Tab until `target` has focus (at most `max` times). */
async function tabTo(page: Page, target: Locator, max = 12): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

test.describe("first visit and choosing", () => {
  test("the prompt, chosen with the keyboard; the card replaces it and survives a reload", async ({
    page,
  }) => {
    await open(page, "/", 390);
    const prompt = page.getByRole("region", { name: "Pick your team" });
    await expect(prompt).toBeVisible();

    // A button per league; Premier League opens the dialog on its teams.
    await prompt.getByRole("button", { name: "Premier League" }).focus();
    await page.keyboard.press("Enter");
    await expect(dialogOf(page)).toBeVisible();
    expect(await pressedLeague(page)).toEqual(["Premier League"]);
    // Tab reaches the team group in one stop; Space checks the focused team.
    const arsenal = dialogOf(page).getByRole("radio", { name: "Arsenal" });
    await tabTo(page, arsenal);
    await page.keyboard.press("Space");
    await expect(arsenal).toBeChecked();
    await expect(dialogOf(page).locator("[data-picker-selected]")).toHaveText("Selected: Arsenal");
    await tabTo(page, dialogOf(page).getByRole("button", { name: "Save" }));
    await page.keyboard.press("Enter");

    // Save closes the dialog and the page's status region says what happened.
    // Behind the dialog the prompt became the card, so focus goes to the card's
    // heading (the button that opened the dialog is gone), not to the top.
    await expect(dialogOf(page)).toBeHidden();
    await expect(page.locator("[data-fav-status]")).toHaveText("Saved. Arsenal is your team on this device.");
    const card = page.getByRole("article", { name: "Arsenal" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("heading", { level: 2 })).toBeFocused();

    expect(JSON.parse((await stored(page))!)).toEqual({
      v: 1,
      team: "arsenal",
      name: "Arsenal",
      league: "premier_league",
    });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("article", { name: "Arsenal" })).toBeVisible();
  });

  test("the prompt has a button per league with teams, each opening the dialog on it", async ({ page }) => {
    await open(page, "/", 390);
    const buttons = page.getByRole("group", { name: "Choose its league:" }).getByRole("button");
    // The test data has teams in three leagues (La Liga and Serie A have no readable data).
    const leagues = await page.evaluate(() =>
      (
        window as unknown as { tabletalkFavourite: { teams(): [string, string, unknown][] } }
      ).tabletalkFavourite
        .teams()
        .map(([, name]) => name),
    );
    expect(leagues).toEqual(["Premier League", "Bundesliga", "Ligue 1"]);
    await expect(buttons).toHaveText(leagues);
    for (const height of await buttons.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().height),
    ))
      expect(height, "44px targets").toBeGreaterThanOrEqual(44);
    await buttons.filter({ hasText: "Bundesliga" }).click();
    expect(await pressedLeague(page)).toEqual(["Bundesliga"]);
    await expect(shownTeams(page).first()).toBeVisible();
    expect(await stored(page), "opening saves nothing").toBeNull();
  });

  test("Save with no team chosen keeps the dialog open, says so there, focuses the teams and saves nothing", async ({
    page,
  }) => {
    await open(page, "/");
    await page
      .getByRole("region", { name: "Pick your team" })
      .getByRole("button", { name: "Ligue 1" })
      .click();
    await dialogOf(page).getByRole("button", { name: "Save" }).click();
    await expect(dialogOf(page).getByRole("status")).toHaveText("Choose a team first.");
    await expect(dialogOf(page)).toBeVisible();
    await expect(shownTeams(page).first()).toBeFocused();
    await expect(page.locator("[data-fav-status]"), "nothing said behind the dialog").toHaveText("");
    expect(await stored(page)).toBeNull();
  });

  test('"Not now" hides the prompt for good; the space is gone before the first paint', async ({ page }) => {
    await open(page, "/");
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(slot(page)).toBeHidden();
    await expect(page.locator("[data-open-favourite]")).toBeFocused();
    await watchShifts(page);
    await page.reload({ waitUntil: "networkidle" });
    await expect(slot(page)).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.dataset["favState"])).toBe("dismissed");
    await expectNoShift(page);
  });
});

test.describe("where the favourite shows", () => {
  test("every table: a star, a row tint, and 'your team' in the row's name for screen readers", async ({
    page,
  }) => {
    await seed(page, { [KEY]: saved("arsenal"), "tabletalk-theme": LIGHT });
    await open(page, "/premier-league/");
    const row = page.locator('[data-league-table] tr[data-team="arsenal"]');
    expect(await stars(row)).toBe(1);
    await expect(page.getByRole("rowheader", { name: "Arsenal (your team)" }).first()).toBeVisible();
    // Only the favourite: no other row's label is exposed.
    expect(await page.getByRole("rowheader", { name: /your team/ }).count()).toBe(2); // table + heatmap
    const other = page.locator('[data-league-table] tr[data-team="chelsea"]');
    expect(await stars(other)).toBe(0);
    const [tinted, plain] = await Promise.all(
      [row, other].map((r) =>
        r
          .locator("td")
          .nth(2)
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      ),
    );
    expect(tinted).not.toBe(plain);
    // The switcher stars the favourite's league.
    await expect(page.getByRole("link", { name: "Premier League (your team's league)" })).toBeVisible();
  });

  test("match cards involving the favourite are tinted and starred", async ({ page }) => {
    await seed(page, { [KEY]: saved("arsenal") });
    await open(page, "/premier-league/");
    const card = page.locator('[data-match][data-teams~="arsenal"]').first();
    expect(await stars(card)).toBe(1);
    const other = page.locator('[data-match]:not([data-teams~="arsenal"])').first();
    expect(await stars(other)).toBe(0);
  });

  test("the race chart always includes the favourite, with its own column in the numbers", async ({
    page,
  }) => {
    await seed(page, { [KEY]: saved("mainz-05", { league: "bundesliga" }) });
    await open(page, "/bundesliga/");
    const extras = page.locator(".race-chart .panel.extra");
    await expect(extras).toHaveCount(3);
    for (const panel of await extras.all()) await expect(panel).toContainText("Mainz 05 (your team)");
    const chart = page.locator(".race-chart").first();
    await chart.getByText("Show the numbers").click();
    await expect(chart.getByRole("columnheader", { name: "Mainz 05 (your team)" })).toBeVisible();
    // Every row of that table got its cell.
    const rows = chart.locator("tbody tr");
    const cells = await rows.evaluateAll((trs) => trs.map((tr) => tr.children.length));
    expect(new Set(cells).size).toBe(1);
  });

  test("a favourite already in a race gets no extra panel in that chart", async ({ page }) => {
    await seed(page, { [KEY]: saved("bayern-munich", { league: "bundesliga" }) });
    await open(page, "/bundesliga/");
    // Bayern are in the title race (and so in projected points), not the relegation race.
    await expect(page.locator("#race-title-heading ~ ul .panel.extra:visible")).toHaveCount(0);
    await expect(page.locator("#race-points-heading ~ ul .panel.extra:visible")).toHaveCount(0);
    await expect(page.locator("#race-relegation-heading ~ ul .panel.extra:visible")).toHaveCount(1);
    expect(await stars(page.locator('.race-chart li[data-team="bayern-munich"]').first())).toBe(1);
  });

  test("the home page puts the favourite's league first and keeps the card grid tidy", async ({ page }) => {
    await seed(page, { [KEY]: saved("bayern-munich", { league: "bundesliga" }) });
    for (const width of [1024, 1280, 700, 390]) {
      await open(page, "/", width);
      const boxes = await page.locator(".cards > li").evaluateAll((lis) =>
        lis.map((li) => ({
          id: li.getAttribute("data-fav-league-item"),
          ...li.getBoundingClientRect().toJSON(),
        })),
      );
      const first = [...boxes].sort((a, b) => a.top - b.top || a.left - b.left)[0];
      expect(first?.id, `${width}px`).toBe("bundesliga");
      expect(await hasSidewaysScroll(page), `${width}px`).toBe(false);
      // No card sits alone with a gap beside it: each row's cards fill the grid width.
      const grid = await page.locator(".cards").boundingBox();
      const rows = new Map<number, number>();
      for (const b of boxes) rows.set(Math.round(b.top), (rows.get(Math.round(b.top)) ?? 0) + b.width);
      for (const [top, total] of rows) {
        expect(total, `${width}px row at ${top}`).toBeGreaterThan(grid!.width - 4 * 16 - 2);
      }
    }
  });
});

test.describe("matches page: Your team only", () => {
  test("shows only the favourite's matches and says how many", async ({ page }) => {
    await seed(page, { [KEY]: saved("brentford") });
    await open(page, "/premier-league/matches/");
    await page.getByLabel("Your team only").check();
    const visible = page.locator("[data-match]:visible");
    const count = await visible.count();
    expect(count).toBeGreaterThan(0);
    for (const card of await visible.all())
      expect(await card.getAttribute("data-teams")).toMatch(/\bbrentford\b/);
    await expect(page.locator("[data-fav-filter-status]")).toContainText(`Showing ${count} of`);
    // Days left with no match showing are hidden too.
    for (const day of await page.locator(".day:visible").all()) {
      expect(await day.locator("[data-match]:visible").count()).toBeGreaterThan(0);
    }
    await page.getByLabel("Your team only").uncheck();
    await expect(page.locator("[data-fav-filter-status]")).toContainText("Showing all");
  });

  test("not shown on another league's matches page, or without a favourite", async ({ page }) => {
    await seed(page, { [KEY]: saved("brentford") });
    await open(page, "/bundesliga/matches/");
    await expect(page.getByLabel("Your team only")).toBeHidden();
  });

  test("without :has(), cards are still filtered and empty days just keep their heading", async ({
    page,
  }) => {
    await seed(page, { [KEY]: saved("brentford") });
    await open(page, "/premier-league/matches/");
    // Simulate a browser without :has(): delete every rule that uses it.
    const removed = await page.evaluate(() => {
      let n = 0;
      for (const sheet of document.styleSheets) {
        const rules = sheet.cssRules;
        for (let i = rules.length - 1; i >= 0; i--) {
          if (rules[i]!.cssText.includes(":has(")) {
            sheet.deleteRule(i);
            n++;
          }
        }
      }
      return n;
    });
    expect(removed).toBeGreaterThan(0);
    await page.getByLabel("Your team only").check();
    for (const card of await page.locator("[data-match]:visible").all()) {
      expect(await card.getAttribute("data-teams")).toMatch(/\bbrentford\b/);
    }
    const emptyDays = await page
      .locator(".day")
      .evaluateAll((days) => days.filter((d) => !d.querySelector("[data-match]:not([hidden])")).length);
    expect(emptyDays).toBeGreaterThan(0);
    await expect(page.locator(".day .day-heading:visible").first()).toBeVisible();
  });
});

// Personal links (?team=...) were removed before the site was announced. A
// link made while they existed must still open the page and change nothing.
test("an old ?team= link is ignored: no question, nothing saved, the address is left alone", async ({
  page,
}) => {
  await open(page, "/premier-league/?team=chelsea");
  expect(new URL(page.url()).search).toBe("?team=chelsea");
  await expect(page.getByRole("heading", { name: /your team on this device\?/ })).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-fav-offer");
  expect(await stored(page)).toBeNull();
});

test.describe("stored values that can't be used as they are", () => {
  test("a corrupted value counts as nothing: the prompt shows", async ({ page }) => {
    await seed(page, { [KEY]: "{not json" });
    await open(page, "/");
    await expect(page.getByRole("region", { name: "Pick your team" })).toBeVisible();
  });

  test("a value from a newer version of the site is left exactly as it is", async ({ page }) => {
    const newer = JSON.stringify({ v: 2, teams: ["arsenal", "chelsea"] });
    await seed(page, { [KEY]: newer });
    await open(page, "/");
    await expect(slot(page)).toBeHidden();
    expect(await stored(page)).toBe(newer);
  });

  test("a team no longer covered: says so plainly, the stored name shown as text (never HTML)", async ({
    page,
  }) => {
    await seed(page, {
      [KEY]: JSON.stringify({
        v: 1,
        team: "luton-town",
        name: '<img src=x onerror="window.__pwned=1">',
        league: "premier_league",
      }),
    });
    await open(page, "/");
    const message = page.getByRole("region", { name: /isn't in the leagues we cover this season/ });
    await expect(message).toBeVisible();
    await expect(message).toContainText('<img src=x onerror="window.__pwned=1">');
    await expect(message).toContainText("It was in the Premier League when you picked it.");
    expect(await message.locator("img").count()).toBe(0);
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    await message.getByRole("button", { name: "Pick another team" }).click();
    await expect(page.locator("#favourite")).toBeVisible();
  });

  test("a team whose league has no data right now is kept, not dropped", async ({ page }) => {
    await seed(page, {
      [KEY]: JSON.stringify({ v: 1, team: "barcelona", name: "Barcelona", league: "la_liga" }),
    });
    await open(page, "/");
    await expect(page.getByText("There's no forecast for La Liga right now")).toBeVisible();
    expect(JSON.parse((await stored(page))!).team).toBe("barcelona");
  });
});

test("storage blocked: the choice applies to this page, and the dialog says it won't be remembered", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const deny = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    Storage.prototype.getItem = deny;
    Storage.prototype.setItem = deny;
    Storage.prototype.removeItem = deny;
  });
  await open(page, "/");
  await page
    .getByRole("region", { name: "Pick your team" })
    .getByRole("button", { name: "Premier League" })
    .click();
  await dialogOf(page).getByRole("radio", { name: "Arsenal" }).check();
  await dialogOf(page).getByRole("button", { name: "Save" }).click();
  await expect(dialogOf(page)).toBeHidden();
  await expect(page.locator("[data-fav-status]")).toHaveText(
    "Arsenal is your team until you close this page. This browser isn't letting the site remember it.",
  );
  await expect(page.getByRole("article", { name: "Arsenal" })).toBeVisible();
  // Opened again, the dialog carries the warning too.
  await page.locator("[data-open-favourite]").click();
  await expect(page.locator("[data-storage-warning]")).toBeVisible();
});

test.describe("the team page's Make this my team", () => {
  const button = (page: Page) => page.locator('[data-fav-action="choose-this"]');
  const shown = (page: Page) => page.locator("[data-make-status]");

  test("one press saves the team; the label changes, focus stays, and it's announced", async ({ page }) => {
    await open(page, "/premier-league/arsenal/", 360);
    await expect(button(page)).toHaveAccessibleName("Make this my team");
    await expect(button(page).locator(".is-fav")).toBeHidden();
    const box = await button(page).boundingBox();
    expect(box!.height, "a 44px target").toBeGreaterThanOrEqual(44);
    await button(page).focus();
    await page.keyboard.press("Enter");
    expect(JSON.parse((await stored(page))!).team).toBe("arsenal");
    await expect(button(page)).toHaveAccessibleName("Your team · Change");
    await expect(button(page)).toBeFocused();
    await expect(page.locator("[data-fav-status]")).toHaveText("Saved. Arsenal is your team on this device.");
    expect(await stars(page.locator(".team-head h1"))).toBe(1);
    expect(await hasSidewaysScroll(page)).toBe(false);
  });

  test("replacing another favourite says which one it replaced, shown and announced once", async ({
    page,
  }) => {
    await seed(page, { [KEY]: saved("chelsea") });
    await open(page, "/premier-league/arsenal/");
    await expect(button(page)).toHaveAccessibleName("Make this my team");
    await expect(shown(page), "nothing shown before a press").toBeHidden();
    await button(page).click();
    const message = "Saved. Arsenal is your team on this device, instead of Chelsea.";
    await expect(page.locator("[data-fav-status]")).toHaveText(message);
    await expect(shown(page)).toBeVisible();
    await expect(shown(page)).toHaveText(message);
    // Screen readers hear it once, from the status region: the shown copy is hidden from them.
    await expect(shown(page)).toHaveAttribute("aria-hidden", "true");
    expect(await page.getByRole("status").filter({ hasText: "instead of Chelsea" }).count()).toBe(1);
    expect(JSON.parse((await stored(page))!).team).toBe("arsenal");
  });

  test("the shown line clears when the team is changed another way", async ({ page }) => {
    await open(page, "/premier-league/arsenal/");
    await button(page).click();
    await expect(shown(page)).toHaveText("Saved. Arsenal is your team on this device.");
    await button(page).click(); // now "Your team · Change": opens the dialog
    const dialog = dialogOf(page);
    await dialog.getByRole("radio", { name: "Chelsea" }).check();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(shown(page)).toBeHidden();
    await expect(shown(page)).toHaveText("");
  });

  for (const width of [360, 1280]) {
    test(`the shown line after a press is not layout shift, at ${width}px`, async ({ page }) => {
      await seed(page, { [KEY]: saved("chelsea") });
      await watchShifts(page);
      await open(page, "/premier-league/arsenal/", width);
      await button(page).click();
      await expect(shown(page)).toBeVisible();
      await page.waitForTimeout(300);
      await expectNoShift(page);
    });
  }

  test("on the favourite's own page it reads 'Your team · Change' and opens the dialog", async ({ page }) => {
    await seed(page, { [KEY]: saved("arsenal") });
    await open(page, "/premier-league/arsenal/");
    await expect(button(page)).toHaveAccessibleName("Your team · Change");
    await expect(button(page).locator(".not-fav")).toBeHidden();
    await button(page).click();
    await expect(dialogOf(page)).toBeVisible();
    expect(await pressedLeague(page), "on the team's league").toEqual(["Premier League"]);
    await expect(dialogOf(page).getByRole("radio", { name: "Arsenal" })).toBeChecked();
    expect(JSON.parse((await stored(page))!).team, "nothing changed").toBe("arsenal");
  });

  test("storage blocked: the choice applies to this page, and it says so", async ({ page }) => {
    await page.addInitScript(() => {
      const deny = () => {
        throw new DOMException("blocked", "SecurityError");
      };
      Storage.prototype.getItem = deny;
      Storage.prototype.setItem = deny;
      Storage.prototype.removeItem = deny;
    });
    await open(page, "/premier-league/arsenal/");
    await button(page).click();
    await expect(button(page)).toHaveAccessibleName("Your team · Change");
    await expect(page.locator("[data-fav-status]")).toHaveText(
      "Arsenal is your team until you close this page. This browser isn't letting the site remember it.",
    );
  });
});

test.describe("the Your team dialog", () => {
  test("keyboard only: open, choose, save; the dialog closes and focus returns to the button", async ({
    page,
  }) => {
    await seed(page, { [KEY]: saved("arsenal") });
    await open(page, "/premier-league/");
    const opener = page.locator("[data-open-favourite]");
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();
    expect(await pressedLeague(page)).toEqual(["Premier League"]);
    // Tab lands on the checked team (one stop for the whole group).
    const arsenal = dialog.getByRole("radio", { name: "Arsenal" });
    await expect(arsenal).toBeChecked();
    await tabTo(page, arsenal);
    // Arrow keys move and check, but never save: only Save does.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(arsenal).not.toBeChecked();
    expect(JSON.parse((await stored(page))!).team).toBe("arsenal");
    await dialog.getByRole("radio", { name: "Chelsea" }).check();
    await tabTo(page, dialog.getByRole("button", { name: "Save" }));
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(page.locator("[data-fav-status]")).toHaveText("Saved. Chelsea is your team on this device.");
    expect(JSON.parse((await stored(page))!).team).toBe("chelsea");
    await expect.poll(() => stars(page.locator('[data-league-table] tr[data-team="chelsea"]'))).toBe(1);
  });

  test("Save is announced once, from the page's status region, not the dialog's", async ({ page }) => {
    await open(page, "/premier-league/");
    await page.locator("[data-open-favourite]").click();
    await dialogOf(page).getByRole("radio", { name: "Arsenal" }).check();
    await dialogOf(page).getByRole("button", { name: "Save" }).click();
    await expect(dialogOf(page)).toBeHidden();
    const message = "Saved. Arsenal is your team on this device.";
    await expect(page.locator("[data-fav-status]")).toHaveText(message);
    // Given time for a late second copy to arrive (announce() writes after 50 ms).
    await page.waitForTimeout(300);
    expect(await page.getByRole("status").filter({ hasText: message }).count()).toBe(1);
    await expect(page.locator("[data-fav-dialog-status]")).toHaveText("");
  });

  test("Remove my team: the dialog closes, it's announced, focus returns, prompt stays away", async ({
    page,
  }) => {
    await seed(page, { [KEY]: saved("arsenal") });
    await open(page, "/");
    const opener = page.locator("[data-open-favourite]");
    await opener.click();
    await page.getByRole("button", { name: "Remove my team" }).click();
    await expect(dialogOf(page)).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(page.locator("[data-fav-status]")).toHaveText("Removed. No team is saved on this device.");
    expect(JSON.parse((await stored(page))!)).toEqual({ v: 1, team: null, prompt: "dismissed" });
    await expect(slot(page)).toBeHidden();
  });

  test("from the home card's Change team: Save focuses the new card's heading, Remove the Your team button", async ({
    page,
  }) => {
    await seed(page, { [KEY]: saved("arsenal") });
    await open(page, "/");
    const change = () =>
      page.getByRole("article", { name: "Arsenal" }).getByRole("button", { name: "Change team" });
    await change().click();
    await dialogOf(page).getByRole("radio", { name: "Chelsea" }).check();
    await dialogOf(page).getByRole("button", { name: "Save" }).click();
    await expect(dialogOf(page)).toBeHidden();
    const card = page.getByRole("article", { name: "Chelsea" });
    await expect(card.getByRole("heading", { level: 2 })).toBeFocused();

    // The card (and its button) goes with Remove: focus lands on the header's button.
    await card.getByRole("button", { name: "Change team" }).click();
    await dialogOf(page).getByRole("button", { name: "Remove my team" }).click();
    await expect(dialogOf(page)).toBeHidden();
    await expect(slot(page)).toBeHidden();
    await expect(page.locator("[data-open-favourite]")).toBeFocused();
  });

  test("the team page's Your team · Change: Save closes and focus returns to that button", async ({
    page,
  }) => {
    await seed(page, { [KEY]: saved("arsenal") });
    await open(page, "/premier-league/arsenal/");
    const button = page.locator('[data-fav-action="choose-this"]');
    await button.click();
    await dialogOf(page).getByRole("radio", { name: "Chelsea" }).check();
    await dialogOf(page).getByRole("button", { name: "Save" }).click();
    await expect(dialogOf(page)).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveAccessibleName("Make this my team");
  });

  test("without dialog.showModal() (older browsers) it still opens and closes", async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error simulating a browser without the API
      delete HTMLDialogElement.prototype.showModal;
    });
    await open(page, "/");
    await page.locator("[data-open-favourite]").click();
    await expect(page.locator("#favourite")).toBeVisible();
    await page.locator("#favourite [data-close]").click();
    await expect(page.locator("#favourite")).toBeHidden();
    // Save closes it too, with focus back on the button that opened it.
    const opener = page.locator("[data-open-favourite]");
    await opener.click();
    await page.locator('#favourite input[value="arsenal"]').check();
    // With the mouse: shown in place (no top layer), nothing on the page may cover Save.
    await page.locator('#favourite [data-fav-action="save-picker"]').click();
    await expect(page.locator("#favourite")).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("without dialog.showModal(), the Appearance dialog is above the page too: a mouse click reaches its last theme", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // @ts-expect-error simulating a browser without the API
      delete HTMLDialogElement.prototype.showModal;
    });
    await open(page, "/");
    await page.locator("[data-open-appearance]").click();
    const last = page.locator('#appearance input[name="theme"]').last();
    await last.click();
    await expect(last).toBeChecked();
  });
});

test.describe("no layout shift", () => {
  const STATES: [string, Record<string, string | null>, string][] = [
    ["first visit (prompt)", {}, "/"],
    ["a favourite", { [KEY]: saved("arsenal") }, "/"],
    ["no longer covered", { [KEY]: saved("hull-city-1904") }, "/"],
    [
      "league paused",
      { [KEY]: JSON.stringify({ v: 1, team: "barcelona", name: "Barcelona", league: "la_liga" }) },
      "/",
    ],
    ["dismissed", { [KEY]: JSON.stringify({ v: 1, team: null, prompt: "dismissed" }) }, "/"],
    ["league page, favourite", { [KEY]: saved("arsenal") }, "/premier-league/"],
    ["race panel, favourite outside the race", { [KEY]: saved("mainz-05") }, "/bundesliga/"],
    ["team page, this team the favourite", { [KEY]: saved("arsenal") }, "/premier-league/arsenal/"],
    ["team page, another team the favourite", { [KEY]: saved("chelsea") }, "/premier-league/arsenal/"],
  ];
  for (const [name, values, path] of STATES) {
    for (const width of [360, 1280]) {
      test(`${name} at ${width}px`, async ({ page }) => {
        await seed(page, values);
        await watchShifts(page);
        await open(page, path, width);
        await page.waitForTimeout(300);
        await expectNoShift(page);
      });
    }
  }

  for (const width of [320, 768, 1280]) {
    test(`every team's card is complete and within the screen at ${width}px`, async ({ page }) => {
      await open(page, "/", width);
      const result = await page.evaluate(() => {
        const api = (
          window as unknown as {
            tabletalkFavourite: {
              teams(): [string, string, [string, string][]][];
              choose(s: string): boolean;
            };
          }
        ).tabletalkFavourite;
        const target = document.querySelector<HTMLElement>(".your-team-slot [data-fav-target]")!;
        const problems: string[] = [];
        let tallest = 0;
        for (const [, , teams] of api.teams()) {
          for (const [slug, name] of teams) {
            api.choose(slug);
            const card = target.querySelector("article");
            if (!card?.textContent?.includes(name)) problems.push(`${slug}: card missing`);
            if (target.scrollWidth > target.clientWidth + 1) problems.push(`${slug}: wider than its space`);
            if (document.documentElement.scrollWidth > document.documentElement.clientWidth)
              problems.push(`${slug}: page scrolls sideways`);
            tallest = Math.max(tallest, target.getBoundingClientRect().height);
          }
        }
        return { problems, tallest: Math.round(tallest) };
      });
      test.info().annotations.push({ type: "tallest card", description: `${result.tallest}px` });
      expect(result.problems).toEqual([]);
    });
  }

  test("the header is the same height in Barlow and in the fallback font, at every width", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    // A late web font must not change how the header wraps, or the whole page would move.
    const heights = async (fallback: boolean) => {
      if (fallback) await page.route(/\.woff2$/, (route) => route.abort());
      await page.goto("/premier-league/", { waitUntil: "networkidle" });
      const out: Record<number, number> = {};
      for (let width = 320; width <= 1400; width += 10) {
        await page.setViewportSize({ width, height: 800 });
        out[width] = await page.evaluate(() =>
          Math.round(document.querySelector(".site-header")!.getBoundingClientRect().height),
        );
      }
      return out;
    };
    const barlow = await heights(false);
    const fallback = await heights(true);
    const differ = Object.keys(barlow).filter((w) => barlow[Number(w)] !== fallback[Number(w)]);
    expect(differ, "widths where the header height depends on the font").toEqual([]);
  });
});

test.describe("accessibility (axe), light and dark", () => {
  const CASES: [string, Record<string, string | null>, string, ((page: Page) => Promise<void>) | null][] = [
    ["home, prompt", {}, "/", null],
    ["home, favourite", { [KEY]: saved("arsenal") }, "/", null],
    ["home, no longer covered", { [KEY]: saved("hull-city-1904") }, "/", null],
    ["league page, favourite", { [KEY]: saved("mainz-05") }, "/bundesliga/", null],
    [
      "matches, Your team only",
      { [KEY]: saved("brentford") },
      "/premier-league/matches/",
      async (page) => page.getByLabel("Your team only").check(),
    ],
    [
      "Your team dialog, everything open",
      { [KEY]: saved("arsenal") },
      "/",
      async (page) => {
        await page.locator("[data-open-favourite]").click();
        for (const summary of await page.locator("#favourite summary").all()) await summary.click();
      },
    ],
  ];
  for (const theme of [LIGHT, DARK]) {
    for (const [name, values, path, act] of CASES) {
      for (const width of [360, 1280]) {
        test(`${name}, ${theme}, ${width}px`, async ({ page }) => {
          await seed(page, { ...values, "tabletalk-theme": theme });
          await open(page, path, width);
          if (act) await act(page);
          const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
            .analyze();
          expect(
            results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
          ).toEqual([]);
        });
      }
    }
  }
});
