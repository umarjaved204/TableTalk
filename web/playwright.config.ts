import { defineConfig, devices } from "@playwright/test";

// Browser tests run against the BUILT site (npm run build first), served by
// `astro preview`, so they test exactly what would be deployed.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4321",
    // A fixed zone, so time-zone conversion is tested deterministically.
    timezoneId: "Europe/London",
    locale: "en-GB",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx astro preview --host 127.0.0.1 --port 4321",
    url: "http://127.0.0.1:4321/premier-league/",
    reuseExistingServer: true,
    env: { ASTRO_TELEMETRY_DISABLED: "1" },
  },
});
