// Favourite team, in a real browser (desktop Chrome project): every state,
// the picker by keyboard, the personal link (including attempts to inject
// HTML through it), no layout shift, blocked storage, the matches filter,
// accessibility (axe) in light and dark, and graceful fallbacks.
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
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
// 0.1 budget). Under heavy test load there is also pre-existing, sideways
// movement: header items and table columns re-flowing when a late web font
// arrives, and the "Last updated 2 days ago" warning on the test data's
// stale Ligue 1 card. All movement together stays under half the budget.
const MAX_VERTICAL_SHIFT = 0.02;
const MAX_TOTAL_SHIFT = 0.05;

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

test.describe("first visit and choosing", () => {
  test("the prompt, chosen with the keyboard; the card replaces it and survives a reload", async ({
    page,
  }) => {
    await open(page, "/", 390);
    const prompt = page.getByRole("region", { name: "Pick your team" });
    await expect(prompt).toBeVisible();

    const select = page.locator("#pick-team");
    await select.focus();
    await select.selectOption("arsenal");
    await page.keyboard.press("Tab");
    await expect(prompt.getByRole("button", { name: "Save" })).toBeFocused();
    await page.keyboard.press("Enter");

    const card = page.getByRole("article", { name: "Arsenal" });
    await expect(card).toBeVisible();
    await expect(page.locator("[data-fav-status]")).toHaveText("Saved. Arsenal is your team on this device.");
    // Focus moved to the new card's heading, not lost at the top of the page.
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

  test("Save with no team chosen says so and saves nothing", async ({ page }) => {
    await open(page, "/");
    await page.getByRole("region", { name: "Pick your team" }).getByRole("button", { name: "Save" }).click();
    await expect(page.locator("[data-fav-status]")).toHaveText("Choose a team first.");
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

test.describe("personal links", () => {
  test("asks before setting, then removes ?team= from the address bar (other parameters kept)", async ({
    page,
  }) => {
    await open(page, "/premier-league/?view=x&team=chelsea#table");
    expect(new URL(page.url()).search).toBe("?view=x");
    expect(new URL(page.url()).hash).toBe("#table");
    const offer = page.getByRole("heading", { name: "Make Chelsea your team on this device?" });
    await expect(offer).toBeVisible();
    expect(await stored(page)).toBeNull(); // nothing saved before the answer
    await page.getByRole("button", { name: "Make it my team" }).click();
    await expect(offer).toBeHidden();
    await expect(page.locator("[data-fav-status]")).toHaveText("Saved. Chelsea is your team on this device.");
    expect(JSON.parse((await stored(page))!).team).toBe("chelsea");
    await expect.poll(() => stars(page.locator('[data-league-table] tr[data-team="chelsea"]'))).toBe(1);
  });

  test("replacing a different favourite asks first; 'Keep' changes nothing", async ({ page }) => {
    await seed(page, { [KEY]: saved("arsenal") });
    await open(page, "/?team=liverpool");
    await expect(
      page.getByRole("heading", { name: "Replace Arsenal with Liverpool as your team on this device?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Keep Arsenal" }).click();
    expect(JSON.parse((await stored(page))!).team).toBe("arsenal");
    await expect(page.getByRole("article", { name: "Arsenal" })).toBeVisible();
  });

  test("the same team: no question, just says so", async ({ page }) => {
    await seed(page, { [KEY]: saved("arsenal") });
    await open(page, "/?team=arsenal");
    await expect(page.getByText("Arsenal is already your team on this device.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Make it my team" })).toHaveCount(0);
  });

  test("a team not covered this season: says so, changes nothing, and never repeats the link", async ({
    page,
  }) => {
    await seed(page, { [KEY]: saved("arsenal") });
    await open(page, "/?team=hull-city-1904");
    await expect(page.getByText("This link's team isn't one we cover this season.")).toBeVisible();
    await expect(page.locator("main")).not.toContainText("hull-city-1904");
    expect(JSON.parse((await stored(page))!).team).toBe("arsenal");
  });

  const ATTACKS = [
    "<script>window.__pwned=1</script>",
    '"><img src=x onerror="window.__pwned=1">',
    "<svg onload=window.__pwned=1>",
    "javascript:window.__pwned=1",
    'arsenal"><b id=injected>x</b>',
    "__proto__",
    "constructor",
    "%3Cimg%20src%3Dx%20onerror%3Dwindow.__pwned%3D1%3E",
  ];
  for (const attack of ATTACKS) {
    test(`an injection attempt does nothing: ${attack.slice(0, 40)}`, async ({ page }) => {
      const dialogs: string[] = [];
      page.on("dialog", (d) => {
        dialogs.push(d.message());
        void d.dismiss();
      });
      await page.goto("/", { waitUntil: "networkidle" });
      const before = await page.evaluate(
        () => document.querySelectorAll("img, script, svg, b#injected").length,
      );
      await page.goto(`/?team=${encodeURIComponent(attack)}`, { waitUntil: "networkidle" });
      await expect(page.getByText("This link's team isn't one we cover this season.")).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
      expect(
        await page.evaluate(() => document.querySelectorAll("img, script, svg, b#injected").length),
      ).toBe(before);
      expect(dialogs).toEqual([]);
      expect(await page.locator("main").innerText()).not.toContain("pwned");
      expect(new URL(page.url()).search).toBe("");
      expect(await stored(page)).toBeNull();
    });
  }
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
  await page.locator("#pick-team").selectOption("arsenal");
  await page.getByRole("region", { name: "Pick your team" }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("article", { name: "Arsenal" })).toBeVisible();
  await expect(page.locator("[data-fav-status]")).toContainText("isn't letting the site remember it");
  await page.locator("[data-open-favourite]").click();
  await expect(page.locator("[data-storage-warning]")).toBeVisible();
});

test.describe("the Your team dialog", () => {
  test("keyboard only: open, choose, save, close, and focus returns to the button", async ({ page }) => {
    await seed(page, { [KEY]: saved("arsenal") });
    await open(page, "/premier-league/");
    const opener = page.locator("[data-open-favourite]");
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Your team" });
    await expect(dialog).toBeVisible();
    const select = dialog.getByLabel("Choose a team");
    await expect(select).toHaveValue("arsenal");
    await select.focus();
    await select.selectOption("chelsea");
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Save" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("status").first()).toHaveText(
      "Saved. Chelsea is your team on this device.",
    );
    // Arrowing through the select alone never saves: only Save does.
    await select.focus();
    await page.keyboard.press("ArrowDown");
    expect(JSON.parse((await stored(page))!).team).toBe("chelsea");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await expect.poll(() => stars(page.locator('[data-league-table] tr[data-team="chelsea"]'))).toBe(1);
  });

  test("shows the personal link; Copy puts it on the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await seed(page, { [KEY]: saved("arsenal") });
    await open(page, "/");
    await page.locator("[data-open-favourite]").click();
    await page.getByText("Use on another device").click();
    const link = page.locator("[data-personal-link]");
    await expect(link).toHaveText(new URL("/?team=arsenal", page.url()).href);
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.locator("[data-copy-status]")).toHaveText("Link copied.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      new URL("/?team=arsenal", page.url()).href,
    );
    // The test site has no SITE_URL, so there is no QR code (it needs the public address).
    await expect(page.locator("[data-qr-image]")).toHaveCount(0);
  });

  test("Remove my team: back to no favourite, prompt stays away", async ({ page }) => {
    await seed(page, { [KEY]: saved("arsenal") });
    await open(page, "/");
    await page.locator("[data-open-favourite]").click();
    await page.getByRole("button", { name: "Remove my team" }).click();
    await expect(page.getByRole("dialog").getByRole("status").first()).toHaveText(
      "Removed. No team is saved on this device.",
    );
    expect(JSON.parse((await stored(page))!)).toEqual({ v: 1, team: null, prompt: "dismissed" });
    await page.keyboard.press("Escape");
    await expect(slot(page)).toBeHidden();
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
    ["personal link", {}, "/?team=arsenal"],
    ["league page, favourite", { [KEY]: saved("arsenal") }, "/premier-league/"],
    ["race panel, favourite outside the race", { [KEY]: saved("mainz-05") }, "/bundesliga/"],
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
    ["personal link question", { [KEY]: saved("arsenal") }, "/?team=liverpool", null],
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
