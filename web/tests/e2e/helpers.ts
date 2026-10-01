import type { Page } from "@playwright/test";
import { LEAGUES } from "../../src/data/leagues.ts";
import { STORAGE_KEY, THEMES } from "../../src/themes.ts";

export const THEME_IDS = THEMES.map((t) => t.id);
export const WIDTHS = [360, 390, 768, 1024, 1440] as const;
export const LIGHT = "matchday";
export const DARK = "floodlights";

/** Every page the site builds (the test site has one data state per league). */
export const ALL_PAGES = [
  "/",
  ...LEAGUES.flatMap((league) => [`/${league.slug}/`, `/${league.slug}/matches/`]),
  "/track-record/",
  "/methodology/",
  "/about/",
  "/404/",
];

/** Open a page as a returning visitor who chose `theme`, collecting any console errors. */
export async function openAs(page: Page, path: string, theme: string, width: number): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.setViewportSize({ width, height: 900 });
  // Seed the saved theme once per tab (not on every reload, so a test can
  // check that a choice made on the page survives a reload).
  await page.addInitScript(
    ([key, value]) => {
      try {
        if (sessionStorage.getItem("seeded")) return;
        sessionStorage.setItem("seeded", "1");
        if (value === "system") localStorage.removeItem(key!);
        else localStorage.setItem(key!, value!);
      } catch {
        // ignore
      }
    },
    [STORAGE_KEY, theme],
  );
  await page.goto(path, { waitUntil: "networkidle" });
  return errors;
}

export async function hasSidewaysScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}
