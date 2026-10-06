// "Does it look and work like a professional site on a phone?"
//
// Runs on emulated phones (see the mobile projects in playwright.config.ts):
// iPhones use WebKit, Safari's engine; Android phones use Chromium. Each
// project has the phone's real screen size, pixel density, touch input and
// mobile user agent. Everything here is measured, not eyeballed.
import type { Page } from "@playwright/test";
import { expect, test } from "./test.ts";
import { auditLayout, layoutShift, type AuditOptions, type AuditResult } from "./layout-audit.ts";

const PAGES = [
  "/premier-league/",
  "/bundesliga/",
  "/premier-league/matches/",
  "/premier-league/brentford/",
  "/track-record/",
  "/methodology/",
  "/",
  "/404/",
];

/** Audit every view of the page: on phones the league page shows one tab at a
 *  time, so each tab is tapped and measured in turn. Problems are merged. */
async function auditAllViews(page: Page, options: AuditOptions = {}): Promise<AuditResult> {
  const merged = await auditLayout(page, options);
  const tabs = page.getByRole("tab");
  const count = (await page.getByRole("tablist").isVisible()) ? await tabs.count() : 0;
  for (let i = 1; i < count; i++) {
    const label = await tabs.nth(i).innerText();
    await tabs.nth(i).click();
    const audit = await auditLayout(page, options);
    for (const key of Object.keys(merged) as (keyof AuditResult)[]) {
      merged[key].push(...audit[key].map((problem) => `[${label} tab] ${problem}`));
    }
  }
  return merged;
}

test.describe("layout on this phone", () => {
  for (const path of PAGES) {
    test(`${path} fits, reads and taps well`, async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });
      const audit = await auditAllViews(page);
      expect.soft(audit.sidewaysScroll, "page scrolls sideways").toEqual([]);
      expect.soft(audit.offScreen, "content past the right edge").toEqual([]);
      expect.soft(audit.clipped, "clipped content").toEqual([]);
      expect.soft(audit.smallText, "text under 12px").toEqual([]);
      expect.soft(audit.smallTargets, "tap targets under 24x24").toEqual([]);
      expect.soft(audit.smallMainControls, "main controls under 44px").toEqual([]);
      expect.soft(audit.overlappingTargets, "overlapping tap targets").toEqual([]);
    });
  }

  test("the browser is told it's a mobile page, and zoom is never blocked", async ({ page }) => {
    await page.goto("/premier-league/");
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).toContain("width=device-width");
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/);
    // Body text at 16px or more: below that, iOS Safari zooms in when a form field is focused.
    const body = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    expect(body).toBeGreaterThanOrEqual(16);
    const select = await page.evaluate(() => {
      const el = document.querySelector("select");
      return el ? parseFloat(getComputedStyle(el).fontSize) : 16;
    });
    expect(select, "form fields under 16px make iOS zoom in").toBeGreaterThanOrEqual(16);
  });

  test("the browser bar matches the theme, and there's a home-screen icon", async ({ page, request }) => {
    await page.goto("/premier-league/");
    const state = await page.evaluate(() => ({
      meta: document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
      bg: getComputedStyle(document.body).backgroundColor,
    }));
    expect(state.meta, "theme-color = the page background").toBe(state.bg);
    const icon = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
    expect(icon).toBeTruthy();
    expect((await request.get(icon!)).status()).toBe(200);
  });

  test("nothing jumps while the page loads (layout shift <= 0.1)", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "only Chromium reports layout shifts");
    await page.goto("/premier-league/", { waitUntil: "networkidle" });
    expect(await layoutShift(page)).toBeLessThanOrEqual(0.1);
  });
});

test.describe("WCAG reflow and text resizing", () => {
  for (const path of PAGES) {
    test(`${path}: text enlarged to 200% still fits (WCAG 1.4.4)`, async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });
      await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
      const audit = await auditAllViews(page, { sizes: false });
      expect.soft(audit.sidewaysScroll).toEqual([]);
      expect.soft(audit.offScreen).toEqual([]);
      expect.soft(audit.clipped).toEqual([]);
    });
  }

  test.describe("wider text spacing (WCAG 1.4.12)", () => {
    // Injecting a stylesheet needs the CSP relaxed, for this test only.
    test.use({ bypassCSP: true });
    test("nothing is cut off", async ({ page }) => {
      await page.goto("/premier-league/", { waitUntil: "networkidle" });
      await page.addStyleTag({
        content: `* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
                  p { margin-bottom: 2em !important; }`,
      });
      const audit = await auditAllViews(page, { sizes: false });
      expect.soft(audit.sidewaysScroll).toEqual([]);
      expect.soft(audit.offScreen).toEqual([]);
      expect.soft(audit.clipped).toEqual([]);
    });
  });
});

test.describe("touch", () => {
  test("Appearance: opens on tap, fits the screen, a tap changes the theme", async ({ page }) => {
    await page.goto("/premier-league/", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Appearance" }).tap();
    const dialog = page.getByRole("dialog", { name: "Appearance" });
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height, "dialog taller than the screen").toBeLessThanOrEqual(viewport.height);
    await expect(dialog.getByRole("button", { name: "Close" })).toBeInViewport();

    // On short screens the list scrolls inside the dialog; every option must be reachable.
    // The invisible radio covers its whole row, so that's what a finger lands on.
    const programme = dialog.getByRole("radio", { name: /Programme/ });
    await programme.scrollIntoViewIfNeeded();
    await programme.tap();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "programme");
    await dialog.getByRole("button", { name: "Close" }).tap();
    await expect(dialog).toBeHidden();
  });

  test("league chips: current league fully visible, the rest reachable by swiping", async ({ page }) => {
    await page.goto("/ligue-1/", { waitUntil: "networkidle" });
    const current = page.locator('.switcher a[aria-current="page"]');
    await expect(current).toBeInViewport({ ratio: 1 });
    const first = page.locator(".switcher a").first();
    await first.scrollIntoViewIfNeeded();
    await first.tap();
    await expect(page).toHaveURL(/\/premier-league\/$/);
  });

  test("tabs and table controls respond to taps", async ({ page }) => {
    await page.goto("/premier-league/", { waitUntil: "networkidle" });
    const tabs = page.getByRole("tablist");
    if (await tabs.isVisible()) {
      await page.getByRole("tab", { name: "Positions" }).tap();
      await expect(page.locator("#positions")).toBeVisible();
      await page.getByRole("tab", { name: "Table" }).tap();
    }
    await page.locator('label[for="view-full"]').tap();
    await expect(page.locator("[data-league-table]")).toHaveAttribute("data-view", "full");
    await page.locator('label[for="view-short"]').tap();
    await expect(page.locator("[data-league-table] thead th:visible")).toHaveCount(4);
  });
});
