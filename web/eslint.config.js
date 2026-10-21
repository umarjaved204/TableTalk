// @ts-check
import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "dist/",
      "dist-e2e/",
      ".e2e-data/",
      "dist-rollover/",
      ".rollover-data/",
      ".astro/",
      ".data/",
      "node_modules/",
      "src/data/contract.gen.ts",
      "playwright-report/",
      "test-results/",
    ],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  astro.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    // In tests a `!` on fixture data is fine: if the assumption is wrong, the test fails anyway.
    files: ["tests/**"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
  {
    // Placeholders filled in at build time by src/scripts/theme-script.ts.
    files: ["src/scripts/theme-head.js"],
    languageOptions: { globals: { __THEME_IDS__: "readonly", __STORAGE_KEY__: "readonly" } },
  },
  {
    // Joined after favourite-core.js into one script by src/scripts/theme-script.ts,
    // so its functions are in scope; plus the build-time placeholders.
    files: ["src/scripts/favourite-head.js"],
    languageOptions: {
      globals: {
        __FAV_KEY__: "readonly",
        __TEAM_INDEX__: "readonly",
        makeIndex: "readonly",
        parseStored: "readonly",
        resolveFavourite: "readonly",
        readLink: "readonly",
        linkOffer: "readonly",
        withoutTeamParam: "readonly",
        serialize: "readonly",
        findTeam: "readonly",
        favouriteCss: "readonly",
        staleCss: "readonly",
      },
    },
  },
);
