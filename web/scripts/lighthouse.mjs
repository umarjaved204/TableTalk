// Lighthouse on the built site, with the plan's speed budgets.
//
//   npm run build && npm run lighthouse                    gzip (what visitors get)
//   npm run build && npm run lighthouse -- --uncompressed  worst case
//   npm run lighthouse -- --live https://tabletalk.fyi     the live site (monthly check)
//
// Serves dist/ locally, gzip-compressed as a real host serves it, runs
// Lighthouse's mobile profile (a mid-range phone on a slow 4G connection,
// simulated) on eight representative pages (one of each page type: a team
// page among them), prints the scores, and fails if a budget is missed:
//   LCP (largest contentful paint)  <= 2.5 s
//   CLS (cumulative layout shift)   <= 0.1
//   TBT (total blocking time)       <= 200 ms
// The budgets apply to the gzip run. --uncompressed is a worst case (a host
// that doesn't compress): it prints the same table and lists what would be
// over budget, but doesn't fail.
// INP (interaction to next paint) needs a real visitor's clicks, so a lab
// run can't measure it; TBT is the lab measure that tracks it.
//
// Every run also reports each page's element count (Lighthouse's DOM size),
// with no limit: the live pages are measured once a month and the counts
// recorded in README.md ("Monthly live check"), so growth is seen, not
// blocked. (There used to be a per-page element budget in the browser tests;
// it was measured on the test data, which the real pages outgrew.)
//
// --live <address> measures the real site instead of dist/. It launches
// Playwright's Chromium headless shell, not full Chrome: some antivirus
// software intercepts full Chrome's HTTPS and serves pages uncompressed, which
// made the live pages look slower than they are (October 2026).
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
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { chromium } from "@playwright/test";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { serve } from "../tests/e2e/serve.mjs";

const PORT = 4330;
const RUNS = 3;
const PAGES = [
  "/",
  "/premier-league/",
  "/bundesliga/",
  "/premier-league/matches/",
  "/premier-league/arsenal/",
  "/track-record/",
  "/methodology/",
  "/about/",
];
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

/** Playwright's Chromium headless shell, installed next to its Chromium
 *  (ms-playwright/chromium_headless_shell-<revision>/chrome-headless-shell-<platform>/). */
function headlessShell() {
  const full = chromium.executablePath(); // .../ms-playwright/chromium-<rev>/chrome-<platform>/chrome(.exe)
  const revision = basename(dirname(dirname(full)))
    .split("-")
    .pop();
  const base = join(dirname(dirname(dirname(full))), `chromium_headless_shell-${revision}`);
  const folder = existsSync(base)
    ? readdirSync(base).find((name) => name.startsWith("chrome-headless-shell"))
    : undefined;
  const exe =
    folder &&
    join(base, folder, process.platform === "win32" ? "chrome-headless-shell.exe" : "chrome-headless-shell");
  if (!exe || !existsSync(exe)) {
    throw new Error(
      "Chromium headless shell not found: run `npx playwright install chromium-headless-shell`",
    );
  }
  return exe;
}

// npm run lighthouse [-- <folder>] [-- --uncompressed] [-- --live <address>]
const args = process.argv.slice(2);
const liveAt = args.indexOf("--live");
const LIVE = liveAt === -1 ? null : new URL(args[liveAt + 1] ?? "").origin;
const GZIP = !args.includes("--uncompressed");
if (LIVE && !GZIP) throw new Error("--uncompressed is for the local build; the live site is served as it is");
const folderArg = args.find((a, i) => !a.startsWith("--") && i !== liveAt + 1);
const server = LIVE ? null : await serve(folderArg ?? "dist", PORT, { gzip: GZIP });
const BASE = LIVE ?? `http://127.0.0.1:${PORT}`;
const chrome = await launch(
  LIVE
    ? { chromePath: headlessShell(), chromeFlags: ["--no-sandbox"] }
    : { chromePath: chromium.executablePath(), chromeFlags: ["--headless=new", "--no-sandbox"] },
);
mkdirSync(OUT, { recursive: true });

const rows = [];
const failures = [];
try {
  for (const path of PAGES) {
    const runs = [];
    for (let run = 0; run < RUNS; run++) {
      const result = await lighthouse(`${BASE}${path}`, {
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
    // Reported, never a failure (see the top of this file).
    const elements = median(runs.map((r) => r.lhr.audits["dom-size-insight"]?.numericValue ?? Number.NaN));
    row["DOM"] = Number.isFinite(elements) ? elements : "n/a";
    rows.push(row);
  }
} finally {
  chrome.kill();
  server?.close();
}

console.log(
  `[lighthouse] ${
    LIVE
      ? `the live site, ${LIVE}`
      : GZIP
        ? "gzip-compressed, as a real host serves it"
        : "WORST CASE: uncompressed (budgets apply to the gzip run)"
  }`,
);
console.table(rows);
writeFileSync(
  join(OUT, "summary.json"),
  JSON.stringify(
    {
      measured_at: new Date().toISOString(),
      target: LIVE ?? "local build",
      runs: RUNS,
      gzip: GZIP,
      worstCase: !GZIP,
      budgets: BUDGETS,
      pages: rows,
    },
    null,
    2,
  ),
);
if (!GZIP) {
  // Worst case: reported, never a failure (the budgets apply to the gzip run).
  console.log(
    failures.length > 0
      ? `[lighthouse] worst case, over the gzip budgets (median of ${RUNS} runs):\n  ${failures.join("\n  ")}`
      : `[lighthouse] worst case: every page within the gzip budgets too. Reports in ${OUT}/`,
  );
} else if (failures.length > 0) {
  console.error(`[lighthouse] over budget (median of ${RUNS} runs):\n  ${failures.join("\n  ")}`);
  process.exit(1);
} else {
  console.log(
    `[lighthouse] every page within budget (median of ${RUNS} runs: LCP <= 2.5 s, CLS <= 0.1, TBT <= 200 ms). Reports in ${OUT}/`,
  );
}
