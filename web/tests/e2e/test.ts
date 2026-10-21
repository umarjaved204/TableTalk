// Playwright's `test`, with the visitor's clock fixed at FIXTURE_NOW on every
// page. The site compares times with the visitor's clock (stale data, matches
// that have kicked off), so without this the tests would change result as the
// real date moves on. A test can still set another time before opening a page.
import { test as base } from "@playwright/test";
import { FIXTURE_NOW } from "./site.ts";

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(new Date(FIXTURE_NOW));
    await use(page);
  },
});

export { expect } from "@playwright/test";
