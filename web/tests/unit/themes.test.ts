// The theme system. Reads the real CSS files, so the tests check exactly
// what ships:
//   - every theme in src/themes.ts has a CSS file, and every theme defines every token;
//   - every theme uses exactly one of the two data-colour sets;
//   - WCAG 2.2 AA contrast for text, controls, focus and data marks, per theme.
// A theme that fails any of these fails the test run (and so doesn't ship).
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { HeadIndex } from "../../src/data/teams.ts";
import {
  FAV_STORAGE_KEY,
  FILL_SCRIPT,
  asciiJson,
  buildThemeScript,
  cspHash,
  joinSources,
  readSources,
  stripExports,
} from "../../src/scripts/theme-script.ts";
import { STORAGE_KEY, THEMES } from "../../src/themes.ts";

const STYLES = resolve("src/styles");
const THEME_DIR = join(STYLES, "themes");

/** Custom properties (and color-scheme) declared in a block of CSS. */
function declarations(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/(--[\w-]+|color-scheme)\s*:\s*([^;]+);/g)) out.set(m[1]!, m[2]!.trim());
  return out;
}

const themeTokens = new Map(
  readdirSync(THEME_DIR)
    .filter((f) => f.endsWith(".css"))
    .map((f) => [f.replace(/\.css$/, ""), declarations(readFileSync(join(THEME_DIR, f), "utf8"))]),
);

/** The two data-colour sets, and which themes each one lists in its selector. */
const dataSets = [...readFileSync(join(STYLES, "data-colours.css"), "utf8").matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .map((m) => ({
    themes: [...m[1]!.matchAll(/data-theme="([\w-]+)"/g)].map((t) => t[1]!),
    tokens: declarations(m[2]!),
  }))
  .filter((set) => set.themes.length > 0);

// WCAG 2.2 relative luminance and contrast ratio.
function luminance(hex: string): number {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const REFERENCE = themeTokens.get("matchday")!;

describe("theme files", () => {
  it("every theme in the picker has a CSS file, and every CSS file is in the picker", () => {
    expect([...themeTokens.keys()].sort()).toEqual(THEMES.map((t) => t.id).sort());
  });

  it.each(THEMES.map((t) => [t.id]))("%s defines exactly the same tokens as Matchday", (id) => {
    expect([...themeTokens.get(id)!.keys()].sort()).toEqual([...REFERENCE.keys()].sort());
  });

  it("each theme is in exactly one data-colour set, and both sets define the same tokens", () => {
    expect(dataSets).toHaveLength(2);
    for (const theme of THEMES) {
      expect(
        dataSets.filter((set) => set.themes.includes(theme.id)),
        theme.id,
      ).toHaveLength(1);
    }
    expect([...dataSets[0]!.tokens.keys()].sort()).toEqual([...dataSets[1]!.tokens.keys()].sort());
  });

  it("light themes use the light data set, dark themes the dark one", () => {
    for (const theme of THEMES) {
      const scheme = themeTokens.get(theme.id)!.get("color-scheme");
      const set = dataSets.find((s) => s.themes.includes(theme.id))!;
      const setIsLight = set.themes.includes("matchday");
      expect(setIsLight, theme.id).toBe(scheme === "light");
    }
  });
});

// [foreground, background, minimum ratio, what it is]
const TEXT = 4.5;
const UI = 3;
const CHECKS: [string, string, number, string][] = [
  ...(["--bg", "--surface", "--surface-2"] as const).flatMap((bg): [string, string, number, string][] => [
    ["--text", bg, TEXT, "body text"],
    ["--text-muted", bg, TEXT, "muted text"],
    ["--accent", bg, TEXT, "accent as text (links)"],
    ["--focus", bg, UI, "focus ring"],
  ]),
  ["--on-accent", "--accent", TEXT, "text on accent (selected chip, buttons)"],
  ["--border-strong", "--bg", UI, "control border"],
  ["--border-strong", "--surface", UI, "control border"],
  ["--warn-text", "--warn-bg", TEXT, "stale-data warning"],
];
const DATA_MARKS = ["--data-home", "--data-draw", "--data-away", "--zone-top", "--zone-rel"];

describe.each(THEMES.map((t) => [t.id]))("WCAG 2.2 AA contrast: %s", (id) => {
  const tokens = themeTokens.get(id)!;
  const data = dataSets.find((set) => set.themes.includes(id))!.tokens;

  it.each(CHECKS)("%s on %s >= %s (%s)", (fg, bg, min) => {
    expect(contrast(tokens.get(fg)!, tokens.get(bg)!)).toBeGreaterThanOrEqual(min);
  });

  it.each(DATA_MARKS)("data mark %s on the card and striped-row surfaces >= 3", (mark) => {
    for (const bg of ["--surface", "--surface-2"]) {
      expect(contrast(data.get(mark)!, tokens.get(bg)!), `${mark} on ${bg}`).toBeGreaterThanOrEqual(UI);
    }
  });

  it("every heatmap step's text is readable (>= 4.5)", () => {
    for (let step = 1; step <= 7; step++) {
      const ratio = contrast(data.get(`--heat-ink-${step}`)!, data.get(`--heat-${step}`)!);
      expect(ratio, `step ${step}`).toBeGreaterThanOrEqual(TEXT);
    }
  });
});

// The favourite team's row tint (src/styles/favourites.css): 12% of the
// accent mixed into the surface, as CSS color-mix(in srgb, ...) does it
// (straight mix of the 0-255 channel values). High Contrast uses no tint.
function mix(a: string, b: string, share: number): string {
  const channels = (hex: string) => {
    let h = hex.replace("#", "");
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const [x, y] = [channels(a), channels(b)];
  return `#${x
    .map((c, i) => Math.round(c * share + y[i]! * (1 - share)))
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}
const TINT_SHARE =
  Number(
    /--fav-tint:\s*color-mix\(in srgb, var\(--accent\) (\d+)%/.exec(
      readFileSync(join(STYLES, "favourites.css"), "utf8"),
    )![1],
  ) / 100;

describe.each(THEMES.map((t) => [t.id]))("favourite team marking: %s", (id) => {
  const tokens = themeTokens.get(id)!;
  const tint =
    id === "contrast"
      ? tokens.get("--surface")!
      : mix(tokens.get("--accent")!, tokens.get("--surface")!, TINT_SHARE);

  it("text and muted text on the tinted row stay readable (>= 4.5)", () => {
    expect(contrast(tokens.get("--text")!, tint)).toBeGreaterThanOrEqual(TEXT);
    expect(contrast(tokens.get("--text-muted")!, tint)).toBeGreaterThanOrEqual(TEXT);
  });

  it("the star (accent) on the tinted row, and the accent rules on the surface, are visible (>= 3)", () => {
    expect(contrast(tokens.get("--accent")!, tint)).toBeGreaterThanOrEqual(UI);
    expect(contrast(tokens.get("--accent")!, tokens.get("--surface")!)).toBeGreaterThanOrEqual(UI);
  });
});

describe("inline early script (theme and favourite team)", () => {
  const sources = readSources();
  const teams: HeadIndex = {
    leagues: [
      [
        "premier_league",
        "Premier League",
        [
          ["arsenal", "Arsenal"],
          ["evil", "</script><b>"],
        ],
      ],
      ["la_liga", "La Liga", [["atletico-madrid", "Atlético Madrid"]]],
    ],
    names: [["premier_league", "the Premier League"]],
    unavailable: [],
    renames: {},
  };
  const script = buildThemeScript(sources, teams);

  it("has every placeholder filled in and is valid JavaScript", () => {
    expect(script).not.toMatch(/__[A-Z_]+__/);
    expect(script).toContain(JSON.stringify(THEMES.map((t) => t.id)));
    expect(script).toContain(JSON.stringify(STORAGE_KEY));
    expect(script).toContain(JSON.stringify(FAV_STORAGE_KEY));
    expect(() => new Function(script)).not.toThrow();
  });

  it("is plain ASCII with LF line endings, so its CSP hash can't depend on decoding or checkout", () => {
    expect(script).toMatch(/^[\n\x20-\x7e]*$/);
    expect(script).not.toContain("Atlético");
    const crlf = {
      theme: sources.theme.replaceAll("\n", "\r\n"),
      core: sources.core,
      favourite: sources.favourite,
    };
    // Windows line endings in a checkout change nothing in what ships.
    expect(buildThemeScript(crlf, teams)).toBe(script);
  });

  it("a team name can't end the <script> element", () => {
    expect(script).not.toContain("</script>");
    expect(asciiJson("</script>")).not.toContain("<");
    expect(asciiJson("</script>")).toContain("u003c");
  });

  it("keeps the favourite helpers inside a function, out of the page's global scope", () => {
    // Checked on the readable joined source (before minifying).
    const joined = joinSources(sources, teams);
    const wrapper = joined.indexOf("(function () {", joined.indexOf("apply(saved());"));
    expect(wrapper).toBeGreaterThan(-1);
    expect(joined.indexOf("function makeIndex")).toBeGreaterThan(wrapper);
    expect(joined.trimEnd().endsWith("})();")).toBe(true);
  });

  it("is minified: much smaller than the readable source", () => {
    expect(script.length).toBeLessThan(joinSources(sources, teams).length * 0.6);
  });

  it("drops comment lines and the export keywords", () => {
    expect(script).not.toMatch(/^\s*\/\//m);
    expect(script).not.toMatch(/^export /m);
    expect(stripExports("export var A = 1;\nexport function f() {}")).toBe("var A = 1;\nfunction f() {}");
  });

  it("refuses an unknown placeholder", () => {
    expect(() =>
      buildThemeScript({ ...sources, favourite: sources.favourite + "\n__SOMETHING_NEW__" }, teams),
    ).toThrow(/placeholder/);
  });

  it("has a stable CSP hash, and so does the one-line fill script", () => {
    expect(cspHash(script)).toMatch(/^sha256-[A-Za-z0-9+/]+=*$/);
    expect(cspHash(script)).toBe(cspHash(buildThemeScript(readSources(), teams)));
    expect(FILL_SCRIPT).not.toContain("\n");
  });
});
