// Generated content (CSS `content:`) is read out by most screen readers. Any
// decorative text the site's styles add, in a stylesheet or a component's
// <style>, must carry empty alternative text (`content: "i" / ""`), so it is
// shown but not announced.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve("src");
const FILES: (readonly [string, string])[] = readdirSync(SRC, { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith(".css") || f.endsWith(".astro"))
  .map(
    (f) => [relative(SRC, join(SRC, f)).replaceAll("\\", "/"), readFileSync(join(SRC, f), "utf8")] as const,
  );

describe("decorative generated text is not announced", () => {
  it("finds the site's stylesheets and components", () => {
    expect(FILES.some(([f]) => f === "styles/blocks.css")).toBe(true);
    expect(FILES.filter(([f]) => f.endsWith(".astro")).length).toBeGreaterThan(20);
  });

  it.each(FILES.map(([f, text]) => [f, text]))(
    "%s: every non-empty content string has empty alt text",
    (_f, text) => {
      // Drop CSS comments, then find each content declaration with a quoted string.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "");
      for (const m of code.matchAll(/\bcontent:\s*([^;]+);/g)) {
        const value = m[1]!.trim();
        if (!/^"[^"]+"/.test(value)) continue; // content: "" or none: nothing to read
        expect(value, m[0]).toMatch(/\/\s*""$/);
      }
    },
  );

  it("the explanation box's marker is the letter i with empty alt text", () => {
    const blocks = FILES.find(([f]) => f === "styles/blocks.css")![1];
    expect(blocks).toMatch(/\.explain::before\s*\{[^}]*content:\s*"i"\s*\/\s*"";/);
  });
});
