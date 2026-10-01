// Measurements of "does this look and work like a professional site on a
// phone", taken inside the page. Each check returns a list of problems
// (empty = pass), described well enough to find the element.
import type { Page } from "@playwright/test";

export interface AuditOptions {
  /** Smallest acceptable text size in CSS px. */
  minFontPx?: number;
  /** Check text size and tap targets (off for the 200%-text test, where they only get bigger). */
  sizes?: boolean;
}

export interface AuditResult {
  sidewaysScroll: string[];
  smallText: string[];
  smallTargets: string[];
  smallMainControls: string[];
  overlappingTargets: string[];
  clipped: string[];
  offScreen: string[];
}

/** Main controls: about 44px (WCAG 2.2 AAA / platform guidelines). Everything else: 24px (WCAG 2.2 AA). */
const MAIN_CONTROLS = [
  ".switcher a",
  ".site-nav a",
  "[data-tablist] button",
  "[data-open-appearance]",
  ".view label",
  "select[data-chance]",
  "dialog .option label",
  "dialog [data-close]",
].join(",");

export async function auditLayout(page: Page, options: AuditOptions = {}): Promise<AuditResult> {
  const { minFontPx = 12, sizes = true } = options;
  return page.evaluate(
    ({ minFontPx, sizes, MAIN_CONTROLS }) => {
      const vw = document.documentElement.clientWidth;
      const describe = (el: Element) => {
        const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
        const cls = typeof el.className === "string" && el.className ? `.${el.className.split(" ")[0]}` : "";
        return `<${el.tagName.toLowerCase()}${cls}> "${text}"`;
      };
      const isShown = (el: Element): boolean => {
        if (el.closest(".visually-hidden, [hidden], dialog:not([open])")) return false;
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") return false;
        return el.getClientRects().length > 0;
      };
      // Inside a container that scrolls sideways on purpose (table, chip row)?
      const inScroller = (el: Element) => !!el.parentElement?.closest(".scroll, [data-switcher]");

      // 1. The page itself never scrolls sideways.
      const sidewaysScroll =
        document.documentElement.scrollWidth > vw + 1
          ? [`page is ${document.documentElement.scrollWidth}px wide in a ${vw}px viewport`]
          : [];

      // 2. Readable text.
      const smallText: string[] = [];
      if (sizes) {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const el = node.parentElement;
          if (!el || !node.textContent?.trim() || !isShown(el) || el.closest("script, style")) continue;
          const size = parseFloat(getComputedStyle(el).fontSize);
          if (size < minFontPx - 0.01) smallText.push(`${size.toFixed(1)}px ${describe(el)}`);
        }
      }

      // 3. Tap targets. A hidden radio is measured by its label; links inside a
      //    sentence (in a paragraph or a list item) are exempt (WCAG 2.5.8
      //    "inline" exception: their size is set by the line of text).
      const interactive = [
        ...document.querySelectorAll<HTMLElement>(
          'a[href], button, select, input:not([type="hidden"]), [role="tab"], summary',
        ),
      ];
      const targets: { el: Element; rect: DOMRect }[] = [];
      for (const raw of interactive) {
        let el: Element = raw;
        if (raw instanceof HTMLInputElement) {
          const tiny = raw.getBoundingClientRect().width <= 2 || getComputedStyle(raw).opacity === "0";
          const label = raw.id ? document.querySelector(`label[for="${raw.id}"]`) : null;
          if (tiny && label) el = label;
        }
        if (!isShown(el)) continue;
        if (el.tagName === "A") {
          const parent = el.parentElement;
          const inSentence =
            (parent?.tagName === "P" || parent?.tagName === "LI") &&
            [...parent.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 1);
          if (inSentence) continue;
        }
        targets.push({ el, rect: el.getBoundingClientRect() });
      }
      const smallTargets: string[] = [];
      const smallMainControls: string[] = [];
      if (sizes) {
        for (const { el, rect } of targets) {
          const w = Math.round(rect.width);
          const h = Math.round(rect.height);
          if (el.matches(MAIN_CONTROLS) || el.closest(MAIN_CONTROLS)) {
            if (h < 44 || w < 44) smallMainControls.push(`${w}x${h} ${describe(el)}`);
          } else if (h < 24 || w < 24) {
            smallTargets.push(`${w}x${h} ${describe(el)}`);
          }
        }
      }

      // 4. No two tap targets overlap (unless one contains the other).
      const overlappingTargets: string[] = [];
      for (let i = 0; i < targets.length; i++) {
        for (let j = i + 1; j < targets.length; j++) {
          const a = targets[i]!;
          const b = targets[j]!;
          if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
          const x = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
          const y = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
          if (x > 1 && y > 1) overlappingTargets.push(`${describe(a.el)} overlaps ${describe(b.el)}`);
        }
      }

      // 5. No clipped content: a box that hides overflow must not have hidden content.
      const clipped: string[] = [];
      const offScreen: string[] = [];
      for (const el of document.body.querySelectorAll("*")) {
        if (!isShown(el) || el.closest("svg")) continue;
        const style = getComputedStyle(el);
        const hides = (v: string) => v === "hidden" || v === "clip";
        if (
          (hides(style.overflowX) && el.scrollWidth > el.clientWidth + 1) ||
          (hides(style.overflowY) && el.scrollHeight > el.clientHeight + 1)
        ) {
          clipped.push(
            `${describe(el)} content ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`,
          );
        }
        // 6. Nothing sticks out past the right edge of the screen (outside sideways scrollers).
        if (!inScroller(el) && !el.closest("dialog")) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.right > vw + 1)
            offScreen.push(`${describe(el)} ends at ${Math.round(rect.right)}px`);
        }
      }

      return {
        sidewaysScroll,
        smallText,
        smallTargets,
        smallMainControls,
        overlappingTargets,
        clipped,
        offScreen,
      };
    },
    { minFontPx, sizes, MAIN_CONTROLS },
  );
}

/** Total layout shift (CLS-style sum) since page load. Chromium only: WebKit has no layout-shift API. */
export async function layoutShift(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            if (!entry.hadRecentInput) total += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve(total), 1000);
      }),
  );
}
