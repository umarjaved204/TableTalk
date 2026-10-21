// Build a simulated NEXT season's data: .rollover-data/
//
// The season-rollover test (tests/e2e/rollover.spec.ts, run with
// `npm run test:rollover`) builds the site from this, to check what happens
// to favourites and personal links when teams are relegated and promoted.
// Based on the real files at data-16a5512, with:
//   - every league's season moved on a year (2026-27 -> 2027-28);
//   - Premier League: Coventry City, Ipswich Town and Hull City relegated,
//     replaced by Burnley, Leicester City and Sheffield United;
//   - Bundesliga: Hamburger SV replaced by Fortuna Düsseldorf;
//   - no history for the new season (so the race charts say "too early"), but
//     last season's run is in history/ unchanged, so last season's teams that
//     left get stub pages ("not covered this season").
// The numbers themselves are last season's, relabelled: this tests the
// site's handling of team changes, not the model.
//
// Run: node tests/fixtures/make-rollover-data.ts (playwright.rollover.config.ts does this).
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { RENAMES, ROLLOVER_DATA_DIR, ROLLOVER_SEASON } from "./rollover.ts";

/** Replace team names wherever a snapshot names a team. */
function renameTeams(snapshot: Record<string, unknown>, renames: Record<string, string>): void {
  const rename = (name: unknown) => (typeof name === "string" && name in renames ? renames[name] : name);
  for (const row of snapshot["table"] as Record<string, unknown>[]) row["team"] = rename(row["team"]);
  for (const team of snapshot["teams"] as Record<string, unknown>[]) team["team"] = rename(team["team"]);
  for (const match of snapshot["upcoming_matches"] as Record<string, unknown>[]) {
    match["home_team"] = rename(match["home_team"]);
    match["away_team"] = rename(match["away_team"]);
  }
}

const out = resolve(ROLLOVER_DATA_DIR);
rmSync(out, { recursive: true, force: true });
cpSync(resolve("tests/fixtures/data-16a5512"), out, { recursive: true });
// Last season's run, as published (before the files below move on a season).
const made = (JSON.parse(readFileSync(join(out, "latest", "index.json"), "utf8")) as { generated_at: string })
  .generated_at;
const lastSeason = join(out, "history", made.slice(0, 16).replace(/:/g, "") + "Z");
mkdirSync(lastSeason, { recursive: true });
for (const file of readdirSync(join(out, "latest")))
  cpSync(join(out, "latest", file), join(lastSeason, file));
for (const file of readdirSync(join(out, "latest"))) {
  if (file === "index.json") continue;
  const path = join(out, "latest", file);
  const snapshot = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const competition = snapshot["competition"] as Record<string, unknown>;
  competition["season"] = ROLLOVER_SEASON;
  renameTeams(snapshot, RENAMES[competition["id"] as string] ?? {});
  writeFileSync(path, JSON.stringify(snapshot));
}
console.log(`[rollover] next-season test data written to ${out}`);
