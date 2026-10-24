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
//   6. Page crossfades (global.css): following a link and Back each fade the
//      whole page, with no element moving on its own and nothing but opacity
//      changing; with reduced motion there is no page transition.
//   7. Theme crossfade (theme-head.js): a theme chosen in Appearance fades in
//      over the old one (240 ms, opacity only) and the page ends on it, even
//      after quick changes; with reduced motion it changes at once.
//   8. Star pop (favourite-head.js, favourites.css): saving a team pops its
//      stars once, transform and opacity only, ending on the star's own
//      style; saving again pops again; a page load never does; with reduced
//      motion the stars simply appear.
//   9. Card hover and press (index.astro, LeagueCard.astro, favourites.css):
//      hovering a league's name lifts its card 3px and fades in a shadow,
//      without flicker when the pointer rests on the name's bottom edge;
//      other links on the card don't; a pressed button shrinks to 97%. With
//      reduced motion the shadow still appears and nothing moves.
//
// Each run also fails on any Content Security Policy violation, with one
// narrow exception: WebKit (Playwright's Windows build) refuses its own
// built-in styles for a visible <select> under the site's style-src, and
// reports it in the console. That message is allowed only in WebKit, only
// word for word, and only as many times as the page reported a style-src-attr
// violation on a <select> element. Any other violation still fails.
import type { Page } from "@playwright/test";
import { ALL_PAGES, stars } from "./helpers.ts";
import { expect, test } from "./test.ts";

const WIDTHS = [390, 1280];
const MAX_END_MS = 1000;
const MAX_SHIFT = 0.005;
const WEBKIT_SELECT_MESSAGE =
  "Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive of the Content Security Policy.";

interface Recorded {
  shift: number;
  moved: string[];
}

interface Violation {
  directive: string;
  element: string;
}

/** Console errors and CSP violations from every page the tab shows, Back included. */
interface Collected {
  errors: string[];
  violations: Violation[];
}

interface Running {
  name: string;
  target: string;
  properties: string[];
  iterations: number;
  endTime: number;
}

/** Records layout shift from the very start of the page, and passes each CSP
 *  violation to the test (so violations from every page add up, like console errors). */
function recordFromStart(): void {
  const w = window as unknown as { __recorded: Recorded; __cspViolation: (v: Violation) => void };
  w.__recorded = { shift: 0, moved: [] };
  document.addEventListener("securitypolicyviolation", (event) => {
    const target = event.target instanceof Element ? event.target.nodeName : String(event.target);
    void w.__cspViolation({ directive: event.violatedDirective, element: target });
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

interface Reveal {
  transition: boolean;
  ready: boolean;
  finished: boolean;
  error: string | null;
  animations: { pseudo: string; keyframes: Record<string, unknown>[]; endTime: number }[];
}

/** Records the page transition the new page arrived with, if any (pagereveal). */
function recordReveal(): void {
  const w = window as unknown as { __reveal: Reveal | null };
  w.__reveal = null;
  window.addEventListener("pagereveal", (event) => {
    const transition = (event as Event & { viewTransition: ViewTransition | null }).viewTransition;
    const reveal: Reveal = {
      transition: transition !== null,
      ready: false,
      finished: false,
      error: null,
      animations: [],
    };
    w.__reveal = reveal;
    if (!transition) return;
    transition.ready.then(
      () => {
        reveal.ready = true;
        reveal.animations = document
          .getAnimations()
          .filter((a) => (a.effect as KeyframeEffect).pseudoElement?.startsWith("::view-transition"))
          .map((a) => {
            const effect = a.effect as KeyframeEffect;
            return {
              pseudo: effect.pseudoElement ?? "",
              keyframes: effect
                .getKeyframes()
                .map((frame) =>
                  Object.fromEntries(
                    Object.entries(frame).filter(
                      ([key]) => !["offset", "computedOffset", "easing", "composite"].includes(key),
                    ),
                  ),
                ),
              endTime: Number(effect.getComputedTiming().endTime ?? 0),
            };
          });
      },
      (error: unknown) => (reveal.error = String(error)),
    );
    transition.finished.then(() => (reveal.finished = true));
  });
}

/** Waits for the page to be shown and, when one is expected, for its page
 *  transition to end; then returns what happened. Waiting for a transition
 *  matters on Back: a page restored from the back-forward cache still holds
 *  the record of its first load until its new pagereveal arrives. */
async function revealed(page: Page, expectTransition: boolean): Promise<Reveal> {
  // On a timeout the caller's assertions say what's missing (e.g. "the page crossfaded").
  await page
    .waitForFunction(
      (expected) => {
        const reveal = (window as unknown as { __reveal: Reveal | null }).__reveal;
        if (reveal === null) return false;
        if (!expected) return true;
        return reveal.transition && (reveal.finished || reveal.error !== null);
      },
      expectTransition,
      { timeout: 5000 },
    )
    .catch(() => undefined);
  return page.evaluate(() => (window as unknown as { __reveal: Reveal }).__reveal);
}

/** Every property of a view-transition animation whose value changes between keyframes. */
function changing(reveal: Reveal): string[] {
  return reveal.animations.flatMap((a) => {
    const keys = [...new Set(a.keyframes.flatMap((frame) => Object.keys(frame)))];
    return keys
      .filter((key) => new Set(a.keyframes.map((frame) => String(frame[key]))).size > 1)
      .map((key) => `${a.pseudo}: ${key}`);
  });
}

/** Opens a page as a first-time visitor (System theme, no favourite), collecting
 *  console errors and CSP violations from then on. */
async function open(page: Page, path: string, width: number): Promise<Collected> {
  const collected: Collected = { errors: [], violations: [] };
  page.on("console", (message) => {
    if (message.type() === "error") collected.errors.push(message.text());
  });
  page.on("pageerror", (error) => collected.errors.push(String(error)));
  await page.exposeFunction("__cspViolation", (v: Violation) => collected.violations.push(v));
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(recordFromStart);
  await page.goto(path, { waitUntil: "networkidle" });
  return collected;
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
  { errors, violations }: Collected,
  browserName: string,
): { errors: string[]; violations: string[] } {
  const isSelect = (v: Violation) => v.directive === "style-src-attr" && v.element === "SELECT";
  const allowSelect = browserName === "webkit";
  let selectReports = allowSelect ? violations.filter(isSelect).length : 0;
  const leftErrors = errors.filter((message) => {
    if (message === WEBKIT_SELECT_MESSAGE && selectReports > 0) {
      selectReports--;
      return false;
    }
    return true;
  });
  const leftViolations = violations
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
        const collected = await open(page, path, width);
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

        const left = unexplained(collected, browserName);
        expect(left.violations, "Content Security Policy violations").toEqual([]);
        expect(left.errors, "console errors (including CSP violations)").toEqual([]);

        const { checked, wrong } = await endStates(page);
        expect(wrong, "each animation ends on the page's own style: opacity 1, no transform").toEqual([]);
        expect(checked, "every animation seen at load was checked").toBeGreaterThanOrEqual(atLoad.length);
      });
    }
  });
}

test.describe("page crossfades", () => {
  for (const width of WIDTHS) {
    test(`${width}px: a link and Back each crossfade the page, opacity only`, async ({
      page,
      browserName,
    }) => {
      await page.addInitScript(recordReveal);
      const collected = await open(page, "/", width);
      await page.locator('a.title-link[href="/premier-league/"]').click();
      await page.waitForURL("**/premier-league/");
      for (const step of ["link", "Back"]) {
        const reveal = await revealed(page, true);
        expect(reveal.error, `${step}: the transition ran to the end`).toBeNull();
        expect(reveal.transition && reveal.ready && reveal.finished, `${step}: the page crossfaded`).toBe(
          true,
        );
        const groups = reveal.animations
          .map((a) => a.pseudo)
          .filter((p) => p.startsWith("::view-transition-group"));
        expect([...new Set(groups)], `${step}: only the whole page, no element moves on its own`).toEqual([
          "::view-transition-group(root)",
        ]);
        expect(
          changing(reveal).filter((c) => !c.endsWith(": opacity")),
          `${step}: nothing but opacity changes`,
        ).toEqual([]);
        expect(changing(reveal).length, `${step}: the old and new pages fade`).toBeGreaterThan(0);
        const long = reveal.animations.filter((a) => a.endTime > MAX_END_MS);
        expect(
          long.map((a) => `${a.pseudo}: ${a.endTime} ms`),
          `${step}: over within ${MAX_END_MS} ms`,
        ).toEqual([]);
        if (step === "link") {
          await page.goBack();
          await page.waitForURL((url) => url.pathname === "/");
        }
      }
      const left = unexplained(collected, browserName);
      expect(left.violations, "Content Security Policy violations").toEqual([]);
      expect(left.errors, "console errors (including CSP violations)").toEqual([]);
    });
  }
});

interface Fade {
  pseudo: string;
  changing: string[];
  endTime: number;
}

/** Waits for a view transition on the current page to start and returns its
 *  animations (with the properties whose value changes), or [] if none starts. */
async function viewTransition(page: Page, timeout = 2000): Promise<Fade[]> {
  const handle = await page
    .waitForFunction(
      () => {
        const animations = document
          .getAnimations()
          .filter((a) => (a.effect as KeyframeEffect).pseudoElement?.startsWith("::view-transition"));
        if (animations.length === 0) return null;
        return animations.map((a) => {
          const effect = a.effect as KeyframeEffect;
          const frames = effect.getKeyframes() as Record<string, unknown>[];
          const keys = [...new Set(frames.flatMap((frame) => Object.keys(frame)))].filter(
            (key) => !["offset", "computedOffset", "easing", "composite"].includes(key),
          );
          return {
            pseudo: effect.pseudoElement ?? "",
            changing: keys.filter((key) => new Set(frames.map((frame) => String(frame[key]))).size > 1),
            endTime: Number(effect.getComputedTiming().endTime ?? 0),
          };
        });
      },
      null,
      { timeout, polling: "raf" },
    )
    .catch(() => null);
  return handle ? ((await handle.jsonValue()) as Fade[]) : [];
}

const theme = (page: Page) =>
  page.evaluate(() => ({
    theme: document.documentElement.dataset["theme"],
    choice: document.documentElement.dataset["themeChoice"],
    fading: document.documentElement.hasAttribute("data-theme-fade"),
  }));

test.describe("theme crossfade", () => {
  test("choosing a theme in Appearance crossfades to it, opacity only", async ({ page, browserName }) => {
    const collected = await open(page, "/", 1280);
    await page.locator("[data-open-appearance]").click();
    await page.locator("#theme-floodlights").check();
    const fade = await viewTransition(page);
    expect(fade.length, "the page crossfaded").toBeGreaterThan(0);
    const groups = new Set(fade.map((f) => f.pseudo).filter((p) => p.startsWith("::view-transition-group")));
    expect([...groups], "only the whole page, no element moves on its own").toEqual([
      "::view-transition-group(root)",
    ]);
    expect(
      fade.flatMap((f) => f.changing.filter((c) => c !== "opacity").map((c) => `${f.pseudo}: ${c}`)),
      "nothing but opacity changes",
    ).toEqual([]);
    // Each snapshot has the fade and the browser's constant blend-mode animation.
    const oldAndNew = fade.filter((f) => /^::view-transition-(old|new)\(root\)$/.test(f.pseudo));
    expect(oldAndNew.length, "the old and new page both animate").toBeGreaterThanOrEqual(2);
    expect(
      oldAndNew.filter((f) => f.endTime !== 240).map((f) => `${f.pseudo}: ${f.endTime} ms`),
      "the old and new page fade in 240 ms",
    ).toEqual([]);
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-theme-fade"));
    expect(await theme(page)).toEqual({ theme: "floodlights", choice: "floodlights", fading: false });

    const left = unexplained(collected, browserName);
    expect(left.violations, "Content Security Policy violations").toEqual([]);
    expect(left.errors, "console errors (including CSP violations)").toEqual([]);
  });

  test("quick changes end on the last theme chosen", async ({ page }) => {
    await open(page, "/", 1280);
    await page.locator("[data-open-appearance]").click();
    await page.locator("#theme-tactics").focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-theme-fade"));
    const checked = await page.locator('input[name="theme"]:checked').getAttribute("value");
    expect(await theme(page)).toEqual({ theme: checked, choice: checked, fading: false });
    expect(checked, "two steps on from Tactics Board: Programme, then Night Game").toBe("nightgame");
  });
});

/** From now on, records on the page every CSS animation and transition as it
 *  starts (animationstart, transitionrun), with what it animates. Short
 *  effects (a 200 ms hover, a pop removed after 700 ms) can be over before the
 *  test's next look at the page when the machine is busy; this record can't miss them. */
async function recordStarts(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __starts: Running[] };
    w.__starts = [];
    const record = (event: AnimationEvent | TransitionEvent) => {
      const target = event.target as Element;
      const pseudo = event.pseudoElement || null;
      const animation = document.getAnimations().find((a) => {
        const effect = a.effect as KeyframeEffect;
        if (effect.target !== target || (effect.pseudoElement ?? null) !== pseudo) return false;
        return event instanceof AnimationEvent
          ? a instanceof CSSAnimation && a.animationName === event.animationName
          : a instanceof CSSTransition && a.transitionProperty === event.propertyName;
      });
      const effect = animation?.effect as KeyframeEffect | undefined;
      w.__starts.push({
        name: event instanceof AnimationEvent ? event.animationName : `transition of ${event.propertyName}`,
        target: `${target.tagName}.${target.getAttribute("class") ?? ""}${pseudo ?? ""}`,
        properties: effect
          ? [
              ...new Set(
                effect
                  .getKeyframes()
                  .flatMap((frame) => Object.keys(frame))
                  .filter((key) => !["offset", "computedOffset", "easing", "composite"].includes(key)),
              ),
            ]
          : event instanceof TransitionEvent
            ? [event.propertyName]
            : ["(not found)"],
        iterations: effect?.getComputedTiming().iterations ?? 1,
        endTime: Number(effect?.getComputedTiming().endTime ?? 0),
      });
    };
    document.addEventListener("animationstart", record, true);
    document.addEventListener("transitionrun", record, true);
  });
}

/** What recordStarts has seen so far, after giving the first effect up to `timeout` ms to start. */
async function started(page: Page, timeout = 2000): Promise<Running[]> {
  await page
    .waitForFunction(() => (window as unknown as { __starts: Running[] }).__starts.length > 0, null, {
      timeout,
    })
    .catch(() => undefined);
  return page.evaluate(() => (window as unknown as { __starts: Running[] }).__starts);
}

test.describe("star pop", () => {
  test("saving a team pops its stars once; again on a second save; never on a page load", async ({
    page,
    browserName,
  }) => {
    const collected = await open(page, "/", 1280);
    await page.locator("#pick-team").selectOption("arsenal");
    await recordStarts(page);
    await page.locator('[data-fav-action="save-select"][data-select="pick-team"]').click();
    const popped = (await started(page)).filter((a) => a.name === "star-pop");
    expect(popped.length, "the new team's stars pop").toBeGreaterThan(0);
    expect(
      popped.filter((a) => a.properties.some((p) => p !== "transform" && p !== "opacity")),
      "only transform and opacity",
    ).toEqual([]);
    expect(
      popped.filter((a) => a.iterations !== 1 || a.endTime > MAX_END_MS),
      "once, within 1 s",
    ).toEqual([]);
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
    );
    const { wrong } = await endStates(page);
    expect(wrong, "each star ends on its own style").toEqual([]);
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-fav-just-saved"));

    // The same team again, from the Your team dialog: it pops again.
    await page.locator("[data-open-favourite]").click();
    await recordStarts(page);
    await page.locator('#favourite [data-fav-action="save-select"]').click();
    expect(
      (await started(page)).filter((a) => a.name === "star-pop").length,
      "saving again pops again",
    ).toBeGreaterThan(0);

    await page.reload({ waitUntil: "networkidle" });
    expect(
      (await running(page)).filter((a) => a.name === "star-pop"),
      "no pop on a page load",
    ).toEqual([]);
    expect(await stars(page.locator("body")), "the stars still show").toBeGreaterThan(0);

    const left = unexplained(collected, browserName);
    expect(left.violations, "Content Security Policy violations").toEqual([]);
    expect(left.errors, "console errors (including CSP violations)").toEqual([]);
  });
});

const LIFTED = "matrix(1, 0, 0, 1, 0, -3)";
const flat = (transform: string) => (transform === "matrix(1, 0, 0, 1, 0, 0)" ? "none" : transform);

/** The first league card on the home page: its lift, its shadow and whether its name is hovered. */
const card = (page: Page) =>
  page.evaluate(() => {
    const item = document.querySelector(".cards li");
    const link = item?.querySelector(".title-link");
    if (!item || !link) throw new Error("no league card");
    return {
      transform: getComputedStyle(item).transform,
      shadow: getComputedStyle(item, "::after").opacity,
      hovered: link.matches(":hover"),
    };
  });

/** The card's state on each of the next `frames` frames. */
const cardOverFrames = (page: Page, frames: number) =>
  page.evaluate(async (count) => {
    const item = document.querySelector(".cards li");
    const link = item?.querySelector(".title-link");
    if (!item || !link) throw new Error("no league card");
    const seen: string[] = [];
    for (let i = 0; i < count; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      seen.push(`${getComputedStyle(item).transform} ${link.matches(":hover") ? "hovered" : "not hovered"}`);
    }
    return seen;
  }, frames);

test.describe("card hover and button press", () => {
  test("hovering a league's name lifts its card and fades in its shadow; other links don't", async ({
    page,
  }) => {
    await open(page, "/", 1280);
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
    );
    await recordStarts(page);
    await page.locator(".cards li .title-link").first().hover();
    const moving = (await started(page)).filter((a) => a.name.startsWith("transition"));
    expect(moving.length, "the lift and the shadow are transitions").toBeGreaterThan(0);
    expect(
      moving.filter((a) => a.properties.some((p) => p !== "transform" && p !== "opacity")),
      "only transform and opacity",
    ).toEqual([]);
    await page.waitForTimeout(400);
    expect(await card(page)).toEqual({ transform: LIFTED, shadow: "1", hovered: true });

    await page.locator(".cards li .fav-name").first().hover();
    await page.waitForTimeout(400);
    const other = await card(page);
    expect({ ...other, transform: flat(other.transform) }, "another link on the card: no lift").toEqual({
      transform: "none",
      shadow: "0",
      hovered: false,
    });
  });

  test("a pointer resting on the name's bottom edge keeps the card lifted, without flicker", async ({
    page,
  }) => {
    await open(page, "/", 1280);
    const box = await page.locator(".cards li .title-link").first().boundingBox();
    if (!box) throw new Error("no league name");
    const x = box.x + box.width / 2;
    const bottom = box.y + box.height;
    // Clearly below the name: no hover, no lift.
    await page.mouse.move(x, bottom + 3);
    await page.waitForTimeout(400);
    expect(new Set(await cardOverFrames(page, 10)), "below the name").toEqual(new Set(["none not hovered"]));
    // Just inside its bottom edge: lifted, and it stays that way on every frame.
    await page.mouse.move(x, bottom - 1);
    await page.waitForTimeout(400);
    expect(new Set(await cardOverFrames(page, 30)), "on the bottom edge").toEqual(
      new Set([`${LIFTED} hovered`]),
    );
    // Just outside it, where the edge is rounded to whole pixels, and 2px out:
    // each settles into one state and holds it.
    for (const offset of [1, 2]) {
      await page.mouse.move(x, bottom + 3);
      await page.waitForTimeout(400);
      await page.mouse.move(x, bottom + offset);
      await page.waitForTimeout(600);
      const states = new Set(await cardOverFrames(page, 30));
      expect(states.size, `${offset}px below the edge: no flicker (${[...states].join(" | ")})`).toBe(1);
      expect([`${LIFTED} hovered`, "none not hovered"]).toContain([...states][0]);
    }
  });

  test("a pressed button shrinks to 97%", async ({ page }) => {
    await open(page, "/", 1280);
    const box = await page.locator('[data-fav-action="save-select"][data-select="pick-team"]').boundingBox();
    if (!box) throw new Error("no Save button");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(300);
    const pressed = await page
      .locator('[data-fav-action="save-select"][data-select="pick-team"]')
      .evaluate((el) => getComputedStyle(el).transform);
    await page.mouse.up();
    expect(pressed).toBe("matrix(0.97, 0, 0, 0.97, 0, 0)");
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("hovering a league's name shows the shadow without a lift; a press doesn't shrink", async ({
    page,
  }) => {
    await open(page, "/", 1280);
    await page.locator(".cards li .title-link").first().hover();
    expect(await running(page), "no animation with reduced motion").toEqual([]);
    const hovered = await card(page);
    expect({ ...hovered, transform: flat(hovered.transform) }).toEqual({
      transform: "none",
      shadow: "1",
      hovered: true,
    });
    const save = page.locator('[data-fav-action="save-select"][data-select="pick-team"]');
    const box = await save.boundingBox();
    if (!box) throw new Error("no Save button");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    expect(flat(await save.evaluate((el) => getComputedStyle(el).transform)), "no shrink").toBe("none");
    await page.mouse.up();
  });

  test("saving a team shows its stars without a pop", async ({ page }) => {
    await open(page, "/", 1280);
    await page.locator("#pick-team").selectOption("arsenal");
    await page.locator('[data-fav-action="save-select"][data-select="pick-team"]').click();
    expect(await running(page), "no animation with reduced motion").toEqual([]);
    expect(await stars(page.locator("body")), "the stars show").toBeGreaterThan(0);
  });

  test("choosing a theme changes it at once, without a crossfade", async ({ page }) => {
    await open(page, "/", 1280);
    await page.locator("[data-open-appearance]").click();
    await page.locator("#theme-floodlights").check();
    expect(await theme(page), "applied at once").toEqual({
      theme: "floodlights",
      choice: "floodlights",
      fading: false,
    });
    expect(await viewTransition(page, 500), "no crossfade with reduced motion").toEqual([]);
  });

  test("following a link changes the page without a transition", async ({ page }) => {
    await page.addInitScript(recordReveal);
    await open(page, "/", 1280);
    await page.locator('a.title-link[href="/premier-league/"]').click();
    await page.waitForURL("**/premier-league/");
    // Give a transition time to start if one were coming, then check there was none.
    await page.waitForLoadState("networkidle");
    expect((await revealed(page, false)).transition, "no page transition with reduced motion").toBe(false);
  });

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
  const select: Violation[] = [{ directive: "style-src-attr", element: "SELECT" }];
  const seen = (errors: string[], violations = select): Collected => ({ errors, violations });
  // Allowed: WebKit, the exact message, one report on a <select>.
  expect(unexplained(seen([WEBKIT_SELECT_MESSAGE]), "webkit")).toEqual({ errors: [], violations: [] });
  // Not allowed: Chromium; a second message with only one report; a violation on
  // another element; any other wording.
  expect(unexplained(seen([WEBKIT_SELECT_MESSAGE]), "chromium").errors).toEqual([WEBKIT_SELECT_MESSAGE]);
  expect(unexplained(seen([WEBKIT_SELECT_MESSAGE, WEBKIT_SELECT_MESSAGE]), "webkit").errors).toHaveLength(1);
  expect(
    unexplained(seen([WEBKIT_SELECT_MESSAGE], [{ directive: "style-src-attr", element: "DIV" }]), "webkit"),
  ).toEqual({ errors: [WEBKIT_SELECT_MESSAGE], violations: ["style-src-attr on DIV"] });
  expect(unexplained(seen([`${WEBKIT_SELECT_MESSAGE} extra`]), "webkit").errors).toHaveLength(1);
});
