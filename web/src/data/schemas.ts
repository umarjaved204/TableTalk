// Which schemas to check a published file against.
//
// The site reads files written over many months: history/ keeps every run's
// snapshot with the contract version it was written with. A MINOR version adds
// fields and the schemas then require them, so a 1.1.0 snapshot would fail a
// 1.2.0 schema. So each file is checked against the schemas of the newest
// version that is not newer than the file:
//   - the current version's schemas are read from the pipeline's own folder,
//     ../contracts/ (one copy, so the site can't drift from the pipeline);
//   - each earlier version that files still exist for is a frozen copy in
//     web/contracts/<version>/. Before raising the contract version, copy the
//     current schemas there (a test fails if a version in the contract's
//     history has no frozen copy).
// A file from a later MINOR than the current one is checked against the
// current schemas; the relaxed schemas (load.ts) let its new fields through.
// A file older than every version uses the oldest (1.0.0 files match 1.1.0:
// 1.1.0 only added the lock log and the track record).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CONTRACTS_DIR, SCHEMA_COPIES_DIR } from "./paths.ts";

type Version = [number, number, number];

function parse(version: string): Version | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compare(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** The names that are real versions, parsed, oldest first. */
function parsed(names: string[]): { name: string; version: Version }[] {
  const out: { name: string; version: Version }[] = [];
  for (const name of names) {
    const version = parse(name);
    if (version) out.push({ name, version });
  }
  return out.sort((a, b) => compare(a.version, b.version));
}

/** The pipeline's current contract version: contracts/README.md starts
 *  "# TableTalk data contract, version X.Y.Z". */
export function currentVersion(dir: string = CONTRACTS_DIR): string {
  const first = readFileSync(join(dir, "README.md"), "utf8").split("\n")[0] ?? "";
  const version = /version (\d+\.\d+\.\d+)/.exec(first)?.[1];
  if (!version) throw new Error(`${join(dir, "README.md")} doesn't start with "... version X.Y.Z"`);
  return version;
}

/** The frozen copies of earlier versions in web/contracts/, oldest first. */
export function frozenCopies(dir: string = SCHEMA_COPIES_DIR): string[] {
  if (!existsSync(dir)) return [];
  const folders = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  return parsed(folders.map((entry) => entry.name)).map((copy) => copy.name);
}

/** Every version with schemas: the frozen copies and the current one, oldest first. */
export function schemaVersions(): string[] {
  return parsed([...new Set([...frozenCopies(), currentVersion()])]).map((v) => v.name);
}

/** The newest version that is not newer than `version` (the oldest if all are newer). */
export function schemaVersionFor(version: string, versions: string[] = schemaVersions()): string {
  const target = parse(version);
  const known = parsed(versions);
  const oldest = known[0];
  if (!target || !oldest) throw new Error(`no schemas for contract version "${version}"`);
  let chosen = oldest.name;
  for (const copy of known) {
    if (compare(copy.version, target) <= 0) chosen = copy.name;
  }
  return chosen;
}

export function schemaPath(version: string, file: string): string {
  return version === currentVersion() ? join(CONTRACTS_DIR, file) : join(SCHEMA_COPIES_DIR, version, file);
}
