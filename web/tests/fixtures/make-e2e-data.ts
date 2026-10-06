// Build the data folder the browser tests run against: .e2e-data/
//
// Browser tests must not depend on whatever `npm run data` last fetched (the
// real data changes every night), so they use a fixed site built from:
//   - the real published files at data-16a5512 (29 Sep 2026), unchanged for
//     the Premier League and Bundesliga;
//   - ILLUSTRATED lock log, scores and history runs (see illustrated.ts),
//     with a "mature" track record (183 scored matches, calibration chart shown);
//   - one league per data state, so every state is built and checked by axe:
//       La Liga   unavailable (its file breaks the contract)
//       Serie A   numbers hidden (a newer MAJOR contract version)
//       Ligue 1   kept_previous + provisional with a notice, and no history
//                 (so its race section says "too early")
//   La Liga and Serie A keep their real file as one history run, so their
//   team pages are built from it (a team page exists in every data state).
//
// Run: node tests/fixtures/make-e2e-data.ts (playwright.config.ts does this).
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { writeIllustratedHistory, writeMatureTrackRecord } from "./illustrated.ts";
import { E2E_DATA_DIR } from "../e2e/site.ts";

const REAL = resolve("tests/fixtures/data-16a5512");
const out = resolve(E2E_DATA_DIR);

function edit(path: string, change: (data: Record<string, unknown>) => void): void {
  const file = join(out, path);
  const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  change(data);
  writeFileSync(file, JSON.stringify(data));
}

rmSync(out, { recursive: true, force: true });
cpSync(REAL, out, { recursive: true });
writeFileSync(
  join(out, "SOURCE.json"),
  JSON.stringify({
    branch: "data",
    commit: "16a5512117e4f2cb7634b4d443f57ea33349acd7",
    copied_at: "2026-09-29T19:04:59.948Z",
    note: "test fixture with illustrated additions",
  }),
);

writeMatureTrackRecord(out);
writeIllustratedHistory(out, "premier_league");
writeIllustratedHistory(out, "bundesliga");

/** Keep a league's real latest file as a history run (before it is broken below). */
function keepAsHistory(leagueId: string): void {
  const latest = join(out, "latest", `${leagueId}.json`);
  const made = (JSON.parse(readFileSync(latest, "utf8")) as { generated_at: string }).generated_at;
  const folder = join(out, "history", made.slice(0, 16).replace(/:/g, "") + "Z");
  mkdirSync(folder, { recursive: true });
  cpSync(latest, join(folder, `${leagueId}.json`));
}
keepAsHistory("la_liga");
keepAsHistory("serie_a");

// La Liga: a file that breaks the contract.
writeFileSync(
  join(out, "latest", "la_liga.json"),
  JSON.stringify({ contract_version: "1.1.0", broken: true }),
);

// Serie A: a newer MAJOR version.
edit("latest/serie_a.json", (d) => {
  d["contract_version"] = "2.0.0";
});

// Ligue 1: last night's run failed (older numbers kept), and the table is provisional.
const LIGUE_1_MADE = "2026-09-28T04:40:00Z";
edit("latest/ligue_1.json", (d) => {
  d["generated_at"] = LIGUE_1_MADE;
  d["provisional"] = true;
  d["notices"] = [
    "Illustrated notice: an awarded result is waiting for confirmation, so the table counts it provisionally.",
  ];
});
edit("latest/index.json", (d) => {
  const entry = (d["competitions"] as Record<string, unknown>[]).find((c) => c["id"] === "ligue_1")!;
  Object.assign(entry, {
    status: "kept_previous",
    snapshot_generated_at: LIGUE_1_MADE,
    provisional: true,
    error: "Illustrated: the results source and the check source disagreed",
  });
});

console.log(`[e2e] test data written to ${out}`);
