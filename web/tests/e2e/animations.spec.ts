// The site's motion rules, checked on every built page at a phone and a
// desktop width, in Chromium (desktop-chrome) and WebKit (desktop-webkit):
//
//   1. Only transform and opacity are animated: anything else (colour,
//      width, stroke) costs layout or paint work and is not allowed.
//   2. Every animation plays once and is over within MAX_END_MS. Nothing
//      loops, nothing runs in the background.
//   3. Every animation ends on the page's own style, and that style is
//      opacity 1 and no transform (checked by cancelling it once it has played
//      out). So the page without animation, which is what a visitor sees with
//      reduced motion, without animation support or without JavaScript, is
//      the finished page.
//   4. Reduced motion: no animation runs at all.
//   5. Nothing moves while the page loads and its animations play (layout
//      shift, the same limit as layout-shift.spec.ts).
//
// Each run also fails on any Content Security Policy violation, with one
// narrow exception: WebKit (Playwright's Windows build) refuses its own
// built-in styles for a visible <select> under the site's style-src, and
// reports it in the console. That message is allowed only in WebKit, only
// word for word, and only as many times as the page reported a style-src-attr
// violation on a <select> element. Any other violation still fails.
import type { Page } from "@playwright/test";
import { ALL_PAGES } from "./helpers.ts";
import { expect, test } from "./test.ts";

const WIDTHS = [390, 1280];
const MAX_END_MS = 1000;
const MAX_SHIFT = 0.005;
const WEBKIT_SELECT_MESSAGE =
  "Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive of the Content Security Policy.";

interface Recorded {
  shift: number;
  moved: string[];
  violations: { directive: string; element: string }[];
}

interface Running {
  name: string;
  target: string;
  properties: string[];
  iterations: number;
  endTime: number;
}

/** Records layout shift and CSP violations from the very start of the page. */
function recordFromStart(): void {
  const w = window as unknown as { __recorded: Recorded };
  w.__recorded = { shift: 0, moved: [], violations: [] };
  document.addEventListener("securitypolicyviolation", (event) => {
    const target = event.target instanceof Element ? event.target.nodeName : String(event.target);
    w.__recorded.violations.push({ directive: event.violatedDirective, element: target });
  });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as unknown as {
      value: number;
      hadRecentInput: boolean;
      sources: { node?: Node }[];
    }[]) {
      if (entry.hadRecentInput) continue;
      w.__recorded.shift += entry.value;
      for (const source of entry.sources) {
        const node = source.node;
        w.__recorded.moved.push(
          `${node instanceof Element ? `${node.tagName}.${node.getAttribute("class") ?? ""}` : node?.nodeName} (${entry.value.toFixed(4)})`,
        );
      }
    }
  }).observe({ type: "layout-shift", buffered: true });
}

/** Opens a page as a first-time visitor (System theme, no favourite) and collects console errors. */
async function open(page: Page, path: string, width: number): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(recordFromStart);
  await page.goto(path, { waitUntil: "networkidle" });
  return errors;
}

/** Every animation and transition running now, with what it animates. */
async function running(page: Page): Promise<Running[]> {
  return page.evaluate(() =>
    document.getAnimations().map((animation) => {
      const effect = animation.effect as KeyframeEffect;
      const target = effect.target;
      return {
        name:
          animation instanceof CSSAnimation
            ? animation.animationName
            : animation instanceof CSSTransition
              ? `transition of ${animation.transitionProperty}`
              : "script animation",
        target: `${target ? `${target.tagName}.${target.getAttribute("class") ?? ""}` : "?"}${effect.pseudoElement ?? ""}`,
        properties: [
          ...new Set(
            effect
              .getKeyframes()
              .flatMap((frame) => Object.keys(frame))
              .filter((key) => !["offset", "computedOffset", "easing", "composite"].includes(key)),
          ),
        ],
        iterations: effect.getComputedTiming().iterations ?? 1,
        endTime: Number(effect.getComputedTiming().endTime ?? 0),
      };
    }),
  );
}

/** Scrolls to the bottom and back in steps, so anything that starts on scroll has started. */
async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    window.scrollTo(0, 0);
  });
}

/** For every animation that has played out: its end state, then (cancelled)
 *  the element's own style. Both must be opacity 1 and no transform, so the
 *  animation ends exactly on the page without animation. */
async function endStates(page: Page): Promise<{ checked: number; wrong: string[] }> {
  return page.evaluate(() => {
    const wrong: string[] = [];
    // WebKit reports a finished scale(1) as the identity matrix: the same as none.
    const IDENTITY = ["matrix(1, 0, 0, 1, 0, 0)", "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)"];
    const read = (el: Element, pseudo: string | null) => {
      const style = getComputedStyle(el, pseudo);
      const transform = IDENTITY.includes(style.transform) ? "none" : style.transform;
      return `opacity ${style.opacity}, transform ${transform}`;
    };
    const animations = document.getAnimations();
    for (const animation of animations) {
      const effect = animation.effect as KeyframeEffect;
      const target = effect.target;
      if (!target) continue;
      const end = read(target, effect.pseudoElement);
      animation.cancel();
      const own = read(target, effect.pseudoElement);
      const name = `${target.tagName}.${target.getAttribute("class") ?? ""}${effect.pseudoElement ?? ""}`;
      if (own !== "opacity 1, transform none") wrong.push(`${name}: without animation ${own}`);
      else if (end !== own) wrong.push(`${name}: ends at ${end}`);
    }
    return { checked: animations.length, wrong };
  });
}

/** Console errors and CSP violations that aren't the one allowed WebKit <select> message. */
function unexplained(
  errors: string[],
  recorded: Recorded,
  browserName: string,
): { errors: string[]; violations: string[] } {
  const isSelect = (v: Recorded["violations"][number]) =>
    v.directive === "style-src-attr" && v.element === "SELECT";
  const allowSelect = browserName === "webkit";
  let selectReports = allowSelect ? recorded.violations.filter(isSelect).length : 0;
  const leftErrors = errors.filter((message) => {
    if (message === WEBKIT_SELECT_MESSAGE && selectReports > 0) {
      selectReports--;
      return false;
    }
    return true;
  });
  const leftViolations = recorded.violations
    .filter((v) => !(allowSelect && isSelect(v)))
    .map((v) => `${v.directive} on ${v.element}`);
  return { errors: leftErrors, violations: leftViolations };
}

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    for (const path of ALL_PAGES) {
      test(`${path}: transform and opacity only, once, finished without animation`, async ({
        page,
        browserName,
      }) => {
        const errors = await open(page, path, width);
        const atLoad = await running(page);
        await scrollThrough(page);
        const all = [...atLoad, ...(await running(page))];

        const otherProperties = all.filter((a) =>
          a.properties.some((p) => p !== "transform" && p !== "opacity"),
        );
        expect(
          otherProperties.map((a) => `${a.name} on ${a.target}: ${a.properties.join(", ")}`),
          "only transform and opacity may be animated",
        ).toEqual([]);
        const repeating = all.filter((a) => a.iterations !== 1);
        expect(
          repeating.map((a) => `${a.name} on ${a.target}: ${a.iterations} iterations`),
          "every animation plays once",
        ).toEqual([]);
        const long = all.filter((a) => a.endTime > MAX_END_MS);
        expect(
          long.map((a) => `${a.name} on ${a.target}: ends at ${a.endTime} ms`),
          `over within ${MAX_END_MS} ms`,
        ).toEqual([]);

        // Let the load animations play out before measuring the shift.
        await page.evaluate(() =>
          Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
        );
        const recorded = await page.evaluate(
          () => (window as unknown as { __recorded: Recorded }).__recorded,
        );
        expect(recorded.shift, recorded.moved.join("; ")).toBeLessThan(MAX_SHIFT);

        const left = unexplained(errors, recorded, browserName);
        expect(left.violations, "Content Security Policy violations").toEqual([]);
        expect(left.errors, "console errors (including CSP violations)").toEqual([]);

        const { checked, wrong } = await endStates(page);
        expect(wrong, "each animation ends on the page's own style: opacity 1, no transform").toEqual([]);
        expect(checked, "every animation seen at load was checked").toBeGreaterThanOrEqual(atLoad.length);
      });
    }
  });
}

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  for (const path of ALL_PAGES) {
    test(`${path}: nothing animates`, async ({ page }) => {
      await open(page, path, 1280);
      const atLoad = await running(page);
      await scrollThrough(page);
      const all = [...atLoad, ...(await running(page))];
      expect(
        all.map((a) => `${a.name} on ${a.target}`),
        "no animation with reduced motion",
      ).toEqual([]);
    });
  }
});

test("the allowed WebKit message is the exact text and nothing broader", () => {
  const recorded: Recorded = {
    shift: 0,
    moved: [],
    violations: [{ directive: "style-src-attr", element: "SELECT" }],
  };
  // Allowed: WebKit, the exact message, one report on a <select>.
  expect(unexplained([WEBKIT_SELECT_MESSAGE], recorded, "webkit")).toEqual({ errors: [], violations: [] });
  // Not allowed: Chromium; a second message with only one report; a violation on another element.
  expect(unexplained([WEBKIT_SELECT_MESSAGE], recorded, "chromium").errors).toEqual([WEBKIT_SELECT_MESSAGE]);
  expect(unexplained([WEBKIT_SELECT_MESSAGE, WEBKIT_SELECT_MESSAGE], recorded, "webkit").errors).toHaveLength(
    1,
  );
  const other: Recorded = { ...recorded, violations: [{ directive: "style-src-attr", element: "DIV" }] };
  expect(unexplained([WEBKIT_SELECT_MESSAGE], other, "webkit")).toEqual({
    errors: [WEBKIT_SELECT_MESSAGE],
    violations: ["style-src-attr on DIV"],
  });
  expect(unexplained([`${WEBKIT_SELECT_MESSAGE} extra`], recorded, "webkit").errors).toHaveLength(1);
});
