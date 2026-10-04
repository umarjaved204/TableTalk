// Lighthouse on the built site, with the plan's speed budgets.
//
//   npm run build && npm run lighthouse
//
// Serves dist/ locally, runs Lighthouse's mobile profile (a mid-range phone
// on a slow 4G connection, simulated) on five representative pages, prints
// the scores, and fails if a budget is missed:
//   LCP (largest contentful paint)  <= 2.5 s
//   CLS (cumulative layout shift)   <= 0.1
//   TBT (total blocking time)       <= 200 ms
// INP (interaction to next paint) needs a real visitor's clicks, so a lab
// run can't measure it; TBT is the lab measure that tracks it.
//
// Each page is measured RUNS times and the median is used, as Lighthouse CI
// does: a single run's blocking time varies a lot with whatever else the
// computer is doing (the same page gave 7 ms and 840 ms in two runs).
//
// Known: SEO shows 91 because Lighthouse fetches robots.txt from inside the
// page, and the site's Content Security Policy (connect-src 'none') blocks
// the page from fetching anything. Search engines fetch robots.txt directly,
// so they are not affected; the strict policy is kept.
//
// Reports are written to lighthouse/ (git-ignored): the median run of each
// page as HTML and JSON, plus summary.json. Uses Playwright's Chromium, so
// no separate Chrome install is needed.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { serve } from "../tests/e2e/serve.mjs";

const PORT = 4330;
const RUNS = 3;
const PAGES = ["/", "/premier-league/", "/premier-league/matches/", "/track-record/", "/methodology/"];
const BUDGETS = {
  "largest-contentful-paint": { max: 2500, label: "LCP", unit: "ms" },
  "cumulative-layout-shift": { max: 0.1, label: "CLS", unit: "" },
  "total-blocking-time": { max: 200, label: "TBT", unit: "ms" },
};
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];
const OUT = "lighthouse";

/** The middle value of a list of numbers (RUNS is odd). */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// npm run lighthouse [-- <folder>] [-- --gzip]
const args = process.argv.slice(2);
const GZIP = args.includes("--gzip");
const server = await serve(args.find((a) => !a.startsWith("--")) ?? "dist", PORT, { gzip: GZIP });
const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ["--headless=new", "--no-sandbox"],
});
mkdirSync(OUT, { recursive: true });

const rows = [];
const failures = [];
try {
  for (const path of PAGES) {
    const runs = [];
    for (let run = 0; run < RUNS; run++) {
      const result = await lighthouse(`http://127.0.0.1:${PORT}${path}`, {
        port: chrome.port,
        output: "html",
        logLevel: "error",
        onlyCategories: CATEGORIES,
      });
      if (!result) throw new Error(`no Lighthouse result for ${path}`);
      runs.push(result);
    }

    // The run whose performance score is the median is saved as the report.
    const scores = runs.map((r) => r.lhr.categories["performance"]?.score ?? 0);
    const middle = runs[scores.indexOf(median(scores))] ?? runs[0];
    const name = path === "/" ? "home" : path.replaceAll("/", "-").replace(/^-|-$/g, "");
    writeFileSync(join(OUT, `${name}.html`), Array.isArray(middle.report) ? middle.report[0] : middle.report);
    writeFileSync(join(OUT, `${name}.json`), JSON.stringify(middle.lhr));

    const row = { page: path };
    for (const category of CATEGORIES) {
      row[category] = Math.round(median(runs.map((r) => r.lhr.categories[category]?.score ?? 0)) * 100);
    }
    for (const [id, budget] of Object.entries(BUDGETS)) {
      const value = median(runs.map((r) => r.lhr.audits[id]?.numericValue ?? Number.NaN));
      row[budget.label] = budget.unit === "ms" ? `${Math.round(value)} ms` : value.toFixed(3);
      if (!(value <= budget.max)) {
        failures.push(
          `${path}: ${budget.label} ${row[budget.label]} is over the budget of ${budget.max}${budget.unit && ` ${budget.unit}`}`,
        );
      }
    }
    rows.push(row);
  }
} finally {
  chrome.kill();
  server.close();
}

console.log(`[lighthouse] ${GZIP ? "gzip-compressed, as a real host serves it" : "uncompressed"}`);
console.table(rows);
writeFileSync(
  join(OUT, "summary.json"),
  JSON.stringify({ runs: RUNS, gzip: GZIP, budgets: BUDGETS, pages: rows }, null, 2),
);
if (failures.length > 0) {
  console.error(`[lighthouse] over budget (median of ${RUNS} runs):\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `[lighthouse] every page within budget (median of ${RUNS} runs: LCP <= 2.5 s, CLS <= 0.1, TBT <= 200 ms). Reports in ${OUT}/`,
);
