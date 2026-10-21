import { defineConfig, devices } from "@playwright/test";
import { ROLLOVER_DATA_DIR, ROLLOVER_OUT_DIR, ROLLOVER_PORT } from "./tests/fixtures/rollover.ts";

// The season-rollover test: the site built from a simulated NEXT season
// (tests/fixtures/make-rollover-data.ts: teams relegated and promoted), to
// check favourites and personal links across the change. A separate config,
// because it needs its own build of the site. Run: npm run test:rollover
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /rollover\.spec\.ts/,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${ROLLOVER_PORT}`,
    timezoneId: "Europe/London",
    locale: "en-GB",
    trace: "retain-on-failure",
  },
  retries: 0,
  projects: [{ name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node tests/fixtures/make-rollover-data.ts && npx astro build && node scripts/check-build.mjs ${ROLLOVER_OUT_DIR} && node tests/e2e/serve.mjs ${ROLLOVER_OUT_DIR} ${ROLLOVER_PORT}`,
    url: `http://127.0.0.1:${ROLLOVER_PORT}/premier-league/`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ASTRO_TELEMETRY_DISABLED: "1",
      TABLETALK_DATA_DIR: ROLLOVER_DATA_DIR,
      TABLETALK_OUT_DIR: ROLLOVER_OUT_DIR,
    },
  },
});
