// An automated keyboard-only walk of every page: press Tab from the top of the
// page until focus comes back round, and check each stop the way a keyboard
// user would experience it:
//   - the first stop is the skip link, and it moves focus to the main content;
//   - every stop is visible on screen, with a visible focus ring;
//   - every control on the page is reached (none skipped), with no tabindex
//     above 0, so the order follows the page;
//   - focus never gets stuck (the walk always comes back round).
// The Appearance dialog is opened and closed by keyboard on every page too.
//
// This does not replace a person using the keyboard (is the order sensible?
// are the names clear?): see docs/accessibility-review.md for that checklist.
import type { Page } from "@playwright/test";
import { ALL_PAGES, LIGHT, openAs } from "./helpers.ts";
import { expect, test } from "./test.ts";

const MAX_STOPS = 400;

interface Stop {
  key: string;
  name: string;
  visible: boolean;
  inViewport: boolean;
  ring: boolean;
}

/** Describe the focused element: where it is and whether its focus ring shows. */
async function focused(page: Page): Promise<Stop | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    // A visually hidden radio shows its focus ring on its label.
    const shown =
      el instanceof HTMLInputElement && el.type === "radio"
        ? (document.querySelector<HTMLElement>(`label[for="${el.id}"]`) ?? el)
        : el;
    const rect = shown.getBoundingClientRect();
    const style = getComputedStyle(shown);
    const ring =
      (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none";
    const all = [...document.querySelectorAll("*")];
    return {
      key: `${el.tagName}#${all.indexOf(el)}`,
      name: `${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30)}"`,
      visible: rect.width > 0 && rect.height > 0 && style.visibility !== "hidden",
      inViewport:
        rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth,
      ring,
    };
  });
}

/** Every element that should be a Tab stop, by the same key as `focused`. */
async function expectedStops(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const all = [...document.querySelectorAll("*")];
    const candidates = document.querySelectorAll<HTMLElement>(
      'a[href], button, select, input:not([type="hidden"]), summary, [tabindex]',
    );
    return [...candidates]
      .filter((el) => {
        if (el.tabIndex < 0 || (el as HTMLButtonElement).disabled) return false;
        if (el.closest("dialog:not([open]), [hidden], [inert]")) return false;
        // In a radio group only the checked radio is a Tab stop.
        if (el instanceof HTMLInputElement && el.type === "radio" && !el.checked) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        // Anything inside a closed <details> is not reachable (except its summary).
        const details = el.closest("details");
        if (details && !details.open && el.tagName !== "SUMMARY") return false;
        return (
          el.offsetParent !== null ||
          el.getClientRects().length > 0 ||
          (el instanceof HTMLInputElement && el.type === "radio")
        );
      })
      .map((el) => `${el.tagName}#${all.indexOf(el)}`);
  });
}

for (const width of [1440, 390]) {
  test.describe(`keyboard walk at ${width}px`, () => {
    for (const path of ALL_PAGES) {
      test(path, async ({ page }) => {
        await openAs(page, path, LIGHT, width);
        expect(
          await page
            .locator("[tabindex]")
            .evaluateAll((els) => els.filter((e) => (e as HTMLElement).tabIndex > 0).length),
          "no tabindex above 0 (the order must follow the page)",
        ).toBe(0);

        // 1. The skip link is first, visible when focused, and works.
        await page.keyboard.press("Tab");
        const first = await focused(page);
        expect(first?.name).toContain("Skip to content");
        expect(first?.inViewport && first.ring, "skip link visible with a focus ring").toBe(true);
        await page.keyboard.press("Enter");
        expect(await page.evaluate(() => document.activeElement?.id)).toBe("main");

        // 2. Walk every Tab stop from the top until focus comes back round.
        //    Open the page afresh first: the skip link added "#main" to the
        //    address, and Tab would otherwise start from the main content.
        await page.goto(path, { waitUntil: "networkidle" });
        const expected = await expectedStops(page);
        const stops: Stop[] = [];
        for (let i = 0; i < MAX_STOPS; i++) {
          await page.keyboard.press("Tab");
          const stop = await focused(page);
          if (stop === null || (stops.length > 0 && stop.key === stops[0]?.key)) break;
          stops.push(stop);
        }
        expect(stops.length, "the walk came back round (no keyboard trap)").toBeLessThan(MAX_STOPS);

        const problems = stops.flatMap((s) => [
          ...(s.visible ? [] : [`${s.name}: focused but not visible`]),
          ...(s.inViewport ? [] : [`${s.name}: focused but off screen`]),
          ...(s.ring ? [] : [`${s.name}: no visible focus ring`]),
        ]);
        expect(problems).toEqual([]);

        const reached = new Set(stops.map((s) => s.key));
        expect(
          expected.filter((key) => !reached.has(key)),
          "controls the keyboard never reached",
        ).toEqual([]);
      });
    }
  });
}

test.describe("Appearance dialog by keyboard", () => {
  for (const path of ALL_PAGES) {
    test(path, async ({ page }) => {
      await openAs(page, path, LIGHT, 1024);
      const button = page.getByRole("button", { name: "Appearance" });
      await button.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Appearance" });
      await expect(dialog).toBeVisible();
      expect(
        await dialog.evaluate((d) => d.contains(document.activeElement)),
        "focus moves into the dialog",
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(button, "focus returns to the Appearance button").toBeFocused();
    });
  }
});
