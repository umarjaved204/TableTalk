import { defineConfig, devices } from "@playwright/test";
import { E2E_DATA_DIR, E2E_OUT_DIR, E2E_PORT } from "./tests/e2e/site.ts";

// Browser tests run against a BUILT site, served as plain files (tests/e2e/serve.mjs), so they
// test exactly what would be deployed. It is a separate test site
// (dist-e2e/), built from fixed test data (.e2e-data/, made by
// tests/fixtures/make-e2e-data.ts), so results don't change when the real
// data does. The webServer command below builds it before the tests start.
//
// Projects:
//   desktop-chrome   the accessibility matrix and feature tests (league-page.spec.ts)
//   phone projects   mobile.spec.ts on real phone profiles: screen size, pixel
//                    density, touch and mobile user agent. iPhones run in WebKit
//                    (Safari's engine), Android phones in Chromium.
const MOBILE = /mobile\.spec\.ts/;
const phone = (name: string, device: keyof typeof devices) => ({
  name,
  testMatch: MOBILE,
  use: { ...devices[device] },
});

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    // A fixed zone, so time-zone conversion is tested deterministically.
    timezoneId: "Europe/London",
    locale: "en-GB",
    // Keep a trace (screenshots, DOM snapshots, console, network) of any test
    // that fails, so an intermittent failure can be diagnosed afterwards:
    // npx playwright show-trace test-results/<test>/trace.zip
    // Deliberately NO retries: a retry that passes would hide the failure.
    trace: "retain-on-failure",
  },
  retries: 0,
  projects: [
    { name: "desktop-chrome", testIgnore: MOBILE, use: { ...devices["Desktop Chrome"] } },
    phone("iphone-se", "iPhone SE"), // 320px: the narrowest common phone
    phone("iphone-13", "iPhone 13"),
    phone("iphone-15-pro-max", "iPhone 15 Pro Max"),
    phone("iphone-13-landscape", "iPhone 13 landscape"),
    phone("galaxy-s8", "Galaxy S8"), // 360px Android
    phone("pixel-7", "Pixel 7"),
    phone("pixel-7-landscape", "Pixel 7 landscape"),
  ],
  webServer: {
    command: `node tests/fixtures/make-e2e-data.ts && npx astro build && node scripts/check-build.mjs ${E2E_OUT_DIR} && node tests/e2e/serve.mjs ${E2E_OUT_DIR} ${E2E_PORT}`,
    url: `http://127.0.0.1:${E2E_PORT}/premier-league/`,
    // Always build and serve a fresh test site (never reuse a server that
    // might be showing other data).
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ASTRO_TELEMETRY_DISABLED: "1",
      TABLETALK_DATA_DIR: E2E_DATA_DIR,
      TABLETALK_OUT_DIR: E2E_OUT_DIR,
    },
  },
});
