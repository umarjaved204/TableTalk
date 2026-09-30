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
);
