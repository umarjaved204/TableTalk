import { defineConfig, devices } from "@playwright/test";

// Browser tests run against the BUILT site (npm run build first), served by
// `astro preview`, so they test exactly what would be deployed.
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
    baseURL: "http://127.0.0.1:4321",
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
    command: "npx astro preview --host 127.0.0.1 --port 4321",
    url: "http://127.0.0.1:4321/premier-league/",
    reuseExistingServer: true,
    env: { ASTRO_TELEMETRY_DISABLED: "1" },
  },
});
