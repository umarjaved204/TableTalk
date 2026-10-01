// The test site: where its data and build go, and the moment it is viewed at.
// Shared by playwright.config.ts, make-e2e-data.ts and the tests.

/** Data folder built by tests/fixtures/make-e2e-data.ts (git-ignored). */
export const E2E_DATA_DIR = ".e2e-data";
/** Build output for the test site, separate from the real dist/ (git-ignored). */
export const E2E_OUT_DIR = "dist-e2e";
/** Not the usual 4321, so a running `npm run preview` of the real site is never tested by mistake. */
export const E2E_PORT = 4322;

/** The visitor's clock in every browser test: 15 hours after the fixture
 *  snapshot (2026-09-29 17:56 UTC), so the numbers are fresh and no match has
 *  kicked off. Tests about stale data or kick-offs set a later time. */
export const FIXTURE_NOW = "2026-09-30T09:00:00Z";
