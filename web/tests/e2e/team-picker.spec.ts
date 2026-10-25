// The Your team dialog's picker (src/scripts/team-picker.ts): league buttons,
// then that league's teams as native radio buttons. Built only when the
// dialog first opens; opens on the right league; never saves on its own;
// fits a 360px phone and 200% text; keeps focus clear of the footer; and
// passes axe in every theme with the dialog open.
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { THEME_IDS, openAs } from "./helpers.ts";
import { expect, test } from "./test.ts";

const KEY = "tabletalk-favourite";
const saved = (team: string, league = "premier_league") =>
  JSON.stringify({ v: 1, team, name: "Stored", league });

const dialog = (page: Page) => page.getByRole("dialog", { name: "Your team" });
const radios = (page: Page) => page.locator('#favourite input[type="radio"]');
const shownTeams = (page: Page) => page.locator('#favourite fieldset:not([hidden]) input[type="radio"]');
const pressed = (page: Page) => page.locator('#favourite .league[aria-pressed="true"]').allTextContents();
const stored = (page: Page) => page.evaluate((key) => localStorage.getItem(key), KEY);

async function seed(page: Page, value: string): Promise<void> {
  await page.addInitScript(
    ([key, v]) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem(key!, v!);
    },
    [KEY, value],
  );
}

async function openDialog(page: Page, path: string, width = 1280, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(path, { waitUntil: "networkidle" });
  await page.locator("[data-open-favourite]").click();
  await expect(dialog(page)).toBeVisible();
}

/** Every team in the early script's list: [league id, league name, [[slug, name], ...]]. */
const teamList = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { tabletalkFavourite: { teams(): [string, string, [string, string][]][] } }
    ).tabletalkFavourite.teams(),
  );

test("built only when the dialog first opens, and only once", async ({ page }) => {
  await page.goto("/premier-league/", { waitUntil: "networkidle" });
  await expect(radios(page), "no picker in the page before opening").toHaveCount(0);
  const total = (await teamList(page)).reduce((n, [, , teams]) => n + teams.length, 0);
  await page.locator("[data-open-favourite]").click();
  await expect(radios(page)).toHaveCount(total);
  await page.keyboard.press("Escape");
  await page.locator("[data-open-favourite]").click();
  await expect(radios(page), "opening again doesn't build it twice").toHaveCount(total);
  // One button per league with teams; each shows one group, named by its legend
  // (hidden leagues aren't in the accessibility tree, so only the shown one is found).
  const leagues = await teamList(page);
  await expect(page.locator("#favourite .league")).toHaveText(leagues.map(([, name]) => name));
  for (const [, name] of leagues) {
    await dialog(page).getByRole("button", { name, exact: true }).click();
    await expect(dialog(page).getByRole("group", { name, exact: true })).toBeVisible();
    await expect(page.locator("#favourite fieldset:not([hidden])")).toHaveCount(1);
  }
});

test.describe("which league it opens on", () => {
  test("the page's league, before the favourite's; the footer names the saved team", async ({ page }) => {
    await seed(page, saved("arsenal"));
    await openDialog(page, "/bundesliga/");
    expect(await pressed(page)).toEqual(["Bundesliga"]);
    await expect(page.locator("[data-picker-selected]")).toHaveText("Selected: Arsenal");
    // Arsenal is checked although its league isn't the one shown.
    await expect(page.locator('#favourite input[value="arsenal"]')).toBeChecked();
  });

  test("a team page opens on its league", async ({ page }) => {
    await openDialog(page, "/ligue-1/monaco/");
    expect(await pressed(page)).toEqual(["Ligue 1"]);
  });

  test("the favourite's league on a page without one", async ({ page }) => {
    await seed(page, saved("mainz-05", "bundesliga"));
    await openDialog(page, "/about/");
    expect(await pressed(page)).toEqual(["Bundesliga"]);
    await expect(page.locator("#favourite input:checked")).toHaveAttribute("value", "mainz-05");
  });

  test("otherwise the first league, with nothing selected", async ({ page }) => {
    await openDialog(page, "/about/");
    expect(await pressed(page)).toEqual(["Premier League"]);
    await expect(page.locator("[data-picker-selected]")).toHaveText("No team selected");
  });
});

test("a league button shows its teams only; the checked team stays checked and Save saves it", async ({
  page,
}) => {
  await openDialog(page, "/premier-league/");
  const leagues = await teamList(page);
  await dialog(page).getByRole("radio", { name: "Chelsea" }).check();
  await dialog(page).getByRole("button", { name: "Bundesliga", exact: true }).click();
  expect(await pressed(page)).toEqual(["Bundesliga"]);
  const bundesliga = leagues.find(([id]) => id === "bundesliga")![2];
  await expect(shownTeams(page)).toHaveCount(bundesliga.length);
  // A to Z.
  const names = await page.locator("#favourite fieldset:not([hidden]) .team span").allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  await expect(page.locator("[data-picker-selected]")).toHaveText("Selected: Chelsea");
  await dialog(page).getByRole("button", { name: "Save" }).click();
  await expect(dialog(page).getByRole("status")).toHaveText("Saved. Chelsea is your team on this device.");
  expect(JSON.parse((await stored(page))!).team).toBe("chelsea");
});

test("arrowing through teams and closing stores nothing", async ({ page }) => {
  await seed(page, saved("arsenal"));
  await openDialog(page, "/premier-league/");
  await page.locator('#favourite input[value="arsenal"]').focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
  await expect(page.locator('#favourite input[value="arsenal"]')).not.toBeChecked();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  expect(JSON.parse((await stored(page))!).team).toBe("arsenal");
  // Opening again shows the saved team, not the one passed over.
  await page.locator("[data-open-favourite]").click();
  await expect(page.locator('#favourite input[value="arsenal"]')).toBeChecked();
});

/** Problems with the dialog's layout: anything that scrolls sideways, tiles
 *  whose text doesn't fit, and targets under 44px. */
const layoutProblems = (page: Page) =>
  page.evaluate(() => {
    const problems: string[] = [];
    const box = document.querySelector<HTMLElement>("#favourite")!;
    for (const el of [box, ...box.querySelectorAll<HTMLElement>("*")]) {
      // Hidden elements, and the visually hidden legends (clipped on purpose).
      if ((el.offsetParent === null && el !== box) || el.classList.contains("visually-hidden")) continue;
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "visible")
        problems.push(`scrolls sideways: ${el.className || el.tagName}`);
    }
    for (const span of box.querySelectorAll<HTMLElement>("fieldset:not([hidden]) .team span")) {
      const tile = span.parentElement!;
      if (span.scrollWidth > span.clientWidth + 1 || tile.scrollWidth > tile.clientWidth + 1)
        problems.push(`doesn't fit: ${span.textContent}`);
    }
    for (const el of box.querySelectorAll<HTMLElement>(
      ".league, fieldset:not([hidden]) .team, .foot .button",
    )) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.height < 44 || r.width < 44))
        problems.push(`under 44px: ${el.textContent?.trim()}`);
    }
    return problems;
  });

/** Names that only fit by breaking inside a word: with breaking inside words
 *  switched off, the name overflows its tile. */
const brokenInsideWords = (page: Page) =>
  page.evaluate(() => {
    const broken: string[] = [];
    for (const span of document.querySelectorAll<HTMLElement>(
      "#favourite fieldset:not([hidden]) .team span",
    )) {
      span.style.overflowWrap = "normal";
      if (span.scrollWidth > span.clientWidth + 1) broken.push(span.textContent ?? "");
      span.style.overflowWrap = "";
    }
    return broken;
  });

/** Team tiles wholly inside the dialog's visible area, as it opens (scrolled to the top). */
const teamsVisibleOnOpening = (page: Page) =>
  page.evaluate(() => {
    const box = document.querySelector("#favourite")!.getBoundingClientRect();
    return [...document.querySelectorAll("#favourite fieldset:not([hidden]) .team")].filter((tile) => {
      const r = tile.getBoundingClientRect();
      return r.top >= box.top && r.bottom <= box.bottom;
    }).length;
  });

/** Everything the keyboard reaches in the dialog (Tab through it, then the
 *  arrow keys through every team): each must end up wholly inside the
 *  dialog's visible area, and not under a pinned footer. Returns what wasn't. */
async function hiddenFocus(page: Page): Promise<string[]> {
  const check = () =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      const dialog = document.querySelector<HTMLElement>("#favourite")!;
      if (!el || !dialog.contains(el)) return null;
      const target = el.closest(".team") ?? el;
      const r = target.getBoundingClientRect();
      const box = dialog.getBoundingClientRect();
      const foot = dialog.querySelector(".foot")!;
      const pinned = !dialog.classList.contains("unpinned") && !foot.contains(el);
      const bottom = pinned ? foot.getBoundingClientRect().top : box.bottom;
      const name = (el.getAttribute("value") ?? el.textContent ?? el.tagName).trim().slice(0, 30);
      return r.top >= box.top - 1 && r.bottom <= bottom + 1 ? "" : name;
    });
  const hidden: string[] = [];
  await page.locator("#favourite [data-close]").focus();
  for (let i = 0; i < 25; i++) {
    const result = await check();
    if (result === null) break;
    if (result) hidden.push(`Tab: ${result}`);
    await page.keyboard.press("Tab");
  }
  await shownTeams(page).first().focus();
  const count = await shownTeams(page).count();
  for (let i = 0; i < count; i++) {
    const result = await check();
    if (result) hidden.push(`arrow: ${result}`);
    await page.keyboard.press("ArrowDown");
  }
  return hidden;
}

const columns = (page: Page) =>
  page
    .locator("#favourite fieldset:not([hidden]) .grid")
    .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length);

test.describe("layout", () => {
  test("a name too long for its tile spans two columns: the whole row on a phone, half on desktop", async ({
    page,
  }) => {
    const share = () =>
      page
        .locator("#favourite .team", { hasText: "Borussia Mönchengladbach" })
        .evaluate(
          (tile) => tile.getBoundingClientRect().width / tile.parentElement!.getBoundingClientRect().width,
        );
    await openDialog(page, "/bundesliga/", 360, 740);
    expect(await share(), "the whole row of two").toBeCloseTo(1, 2);
    expect(await brokenInsideWords(page)).toEqual([]);
    // Measured again on resize: in the four-column desktop grid it takes two columns.
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect.poll(share).toBeGreaterThan(0.45);
    expect(await share(), "two of four columns").toBeLessThan(0.55);
    expect(await brokenInsideWords(page)).toEqual([]);
    // In a single column (200% text) nothing is widened: there is nothing to span.
    await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
    await page.setViewportSize({ width: 360, height: 740 });
    await expect(page.locator("#favourite .team.wide")).toHaveCount(0);
    expect(await columns(page)).toBe(1);
  });

  test("360px phone: two columns, 44px targets, every name inside its tile, in every league", async ({
    page,
  }) => {
    await seed(page, saved("arsenal"));
    await openDialog(page, "/", 360, 740);
    expect(await columns(page)).toBe(2);
    const widened: string[] = [];
    for (const [, name] of await teamList(page)) {
      await dialog(page).getByRole("button", { name, exact: true }).click();
      expect(await layoutProblems(page), name).toEqual([]);
      expect(await brokenInsideWords(page), `${name}: names break only between words`).toEqual([]);
      widened.push(
        ...(await page.locator("#favourite fieldset:not([hidden]) .team.wide span").allTextContents()),
      );
    }
    // Borussia Mönchengladbach's longest word doesn't fit half the row, so it takes the whole row.
    expect(widened).toContain("Borussia Mönchengladbach");
    test.info().annotations.push({ type: "full-row tiles", description: widened.join(", ") });
  });

  test("200% text on a 360px phone: one column, nothing sideways, every name fits", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/bundesliga/", { waitUntil: "networkidle" });
    await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
    await page.locator("[data-open-favourite]").click();
    expect(await columns(page)).toBe(1);
    expect((await layoutProblems(page)).filter((p) => !p.startsWith("under 44px"))).toEqual([]);
  });

  test("desktop: four columns, the whole league visible without scrolling", async ({ page }) => {
    await openDialog(page, "/premier-league/", 1280, 900);
    expect(await columns(page)).toBe(4);
    const body = page.locator("#favourite .body");
    const last = shownTeams(page).last();
    const [bodyBox, lastBox] = [await body.boundingBox(), await last.boundingBox()];
    expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(bodyBox!.y + bodyBox!.height);
  });

  test("the footer never covers the focused team (WCAG 2.4.11), at 360 × 640", async ({ page }) => {
    await openDialog(page, "/premier-league/", 360, 640);
    await expect(dialog(page), "normal text: the footer stays pinned").not.toHaveClass(/unpinned/);
    await shownTeams(page).first().focus();
    await page.keyboard.press("ArrowUp"); // wraps to the last team
    await expect(shownTeams(page).last()).toBeFocused();
    const tile = await page.locator("#favourite fieldset:not([hidden]) .team").last().boundingBox();
    const foot = await page.locator("#favourite .foot").boundingBox();
    expect(tile!.y + tile!.height, "the last team is above the footer").toBeLessThanOrEqual(foot!.y + 1);
    await expect(page.locator("#favourite .foot")).toBeVisible();
  });

  // The test site has three leagues (real data: five, so more rows of buttons),
  // so 360 × 740 may stay pinned here; 360 × 640 makes it unpin for certain.
  for (const [height, favourite] of [
    [740, false],
    [740, true],
    [640, true],
  ] as const) {
    test(`200% text at 360 × ${height}${favourite ? ", a team saved" : ""}: a team shows on opening, nothing sideways, focus never hidden`, async ({
      page,
    }) => {
      if (favourite) await seed(page, saved("mainz-05", "bundesliga"));
      await page.setViewportSize({ width: 360, height });
      await page.goto("/bundesliga/", { waitUntil: "networkidle" });
      await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
      await page.locator("[data-open-favourite]").click();
      if (height === 640)
        await expect(dialog(page), "the footer scrolls with the rest").toHaveClass(/unpinned/);
      expect(await teamsVisibleOnOpening(page), "at least one team tile visible").toBeGreaterThanOrEqual(1);
      expect((await layoutProblems(page)).filter((p) => !p.startsWith("under 44px"))).toEqual([]);
      expect(await hiddenFocus(page)).toEqual([]);
      test.info().annotations.push({
        type: "footer",
        description: (await dialog(page).getAttribute("class"))?.includes("unpinned") ? "scrolls" : "pinned",
      });
    });
  }

  test("400% browser zoom (a 1280 × 1024 window is 320 × 256): unpinned, nothing sideways, focus never hidden", async ({
    page,
  }) => {
    await openDialog(page, "/premier-league/", 320, 256);
    await expect(dialog(page)).toHaveClass(/unpinned/);
    expect(await layoutProblems(page)).toEqual([]);
    expect(await hiddenFocus(page)).toEqual([]);
  });

  test("forced colours: the shown league and the checked team differ by more than colour", async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await seed(page, saved("arsenal"));
    await openDialog(page, "/premier-league/");
    const style = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((el) => {
          const s = getComputedStyle(el);
          return { bg: s.backgroundColor, border: s.borderTopWidth };
        });
    const on = await style('#favourite .league[aria-pressed="true"]');
    const off = await style('#favourite .league[aria-pressed="false"]');
    expect(on.bg, "the shown league uses the system's selected colour").not.toBe(off.bg);
    const checked = await style("#favourite .team:has(input:checked)");
    const unchecked = await style("#favourite fieldset:not([hidden]) .team:not(:has(input:checked))");
    expect([checked.border, unchecked.border]).toEqual(["2px", "1px"]);
  });
});

test.describe("axe with the dialog open, every theme", () => {
  for (const theme of THEME_IDS) {
    test(theme, async ({ page }) => {
      await page.addInitScript((key) => localStorage.setItem(key, '{"v":1,"team":"arsenal"}'), KEY);
      const errors = await openAs(page, "/premier-league/", theme, 390);
      await page.locator("[data-open-favourite]").click();
      await expect(dialog(page)).toBeVisible();
      const results = await new AxeBuilder({ page })
        .include("#favourite")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.help})`)).toEqual([]);
      expect(errors, "console errors (including CSP and Trusted Types violations)").toEqual([]);
    });
  }
});
