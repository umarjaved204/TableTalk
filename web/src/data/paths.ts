// Where the build reads from. Everything runs at build time on this machine,
// never in the visitor's browser.
import { join, resolve } from "node:path";

/** The web/ folder (the build is always run from there, via npm scripts). */
export const WEB_ROOT = resolve(process.env["TABLETALK_WEB_ROOT"] ?? process.cwd());

/** Local read-only copy of the `data` branch (npm run data). Tests point this at fixtures. */
export function dataDir(): string {
  return resolve(process.env["TABLETALK_DATA_DIR"] ?? join(WEB_ROOT, ".data"));
}

/** The contract's JSON Schemas, one folder up from web/ (the pipeline's copy). */
export const CONTRACTS_DIR = join(WEB_ROOT, "..", "contracts");

/** The site's own copies, one folder per contract version (web/contracts/1.2.0/...).
 *  Each published file is checked against the schemas of the version it says
 *  it was written with (src/data/schemas.ts); a test keeps the copy of the
 *  pipeline's current version identical to CONTRACTS_DIR. */
export const SCHEMA_COPIES_DIR = join(WEB_ROOT, "contracts");
