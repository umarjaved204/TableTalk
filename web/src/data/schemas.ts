// Which copy of the contract schemas to check a published file against.
//
// The site reads files written over many months: history/ keeps every run's
// snapshot with the contract version it was written with. A MINOR version adds
// fields and the schemas then require them, so a 1.1.0 snapshot would fail a
// 1.2.0 schema. So the site keeps one copy of the schemas per version
// (web/contracts/<version>/) and checks each file against the newest copy that
// is not newer than the file. A file from a later MINOR than any copy is
// checked against the newest copy; the relaxed schemas (load.ts) let its new
// fields through. A file older than every copy uses the oldest (1.0.0 files
// match 1.1.0: 1.1.0 only added the lock log and the track record).
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { SCHEMA_COPIES_DIR } from "./paths.ts";

type Version = [number, number, number];

function parse(version: string): Version | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compare(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** The copies that are real versions, parsed, oldest first. */
function parsed(copies: string[]): { name: string; version: Version }[] {
  const out: { name: string; version: Version }[] = [];
  for (const name of copies) {
    const version = parse(name);
    if (version) out.push({ name, version });
  }
  return out.sort((a, b) => compare(a.version, b.version));
}

/** The versions with a schema copy, oldest first. */
export function schemaCopies(dir: string = SCHEMA_COPIES_DIR): string[] {
  const folders = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  return parsed(folders.map((entry) => entry.name)).map((copy) => copy.name);
}

/** The newest copy that is not newer than `version` (the oldest if all are newer). */
export function schemaVersionFor(version: string, copies: string[] = schemaCopies()): string {
  const target = parse(version);
  const known = parsed(copies);
  const oldest = known[0];
  if (!target || !oldest) throw new Error(`no schema copy for contract version "${version}"`);
  let chosen = oldest.name;
  for (const copy of known) {
    if (compare(copy.version, target) <= 0) chosen = copy.name;
  }
  return chosen;
}

/** The newest copy: what the generated types (contract.gen.ts) are made from. */
export function latestSchemaCopy(copies: string[] = schemaCopies()): string {
  const latest = copies.at(-1);
  if (!latest) throw new Error(`no schema copies in ${SCHEMA_COPIES_DIR}`);
  return latest;
}

export function schemaPath(version: string, file: string): string {
  return join(SCHEMA_COPIES_DIR, version, file);
}
