// Where the build reads from. Everything runs at build time on this machine,
// never in the visitor's browser.
import { join, resolve } from "node:path";

/** The web/ folder (the build is always run from there, via npm scripts). */
export const WEB_ROOT = resolve(process.env["TABLETALK_WEB_ROOT"] ?? process.cwd());

/** Local read-only copy of the `data` branch (npm run data). Tests point this at fixtures. */
export function dataDir(): string {
  return resolve(process.env["TABLETALK_DATA_DIR"] ?? join(WEB_ROOT, ".data"));
}

/** The contract's JSON Schemas, one folder up from web/: the pipeline's own
 *  files, and the current version's schemas for the site too. */
export const CONTRACTS_DIR = join(WEB_ROOT, "..", "contracts");

/** Frozen copies of earlier contract versions, one folder each
 *  (web/contracts/1.1.0/...), for the history/ files written with them
 *  (src/data/schemas.ts). */
export const SCHEMA_COPIES_DIR = join(WEB_ROOT, "contracts");
