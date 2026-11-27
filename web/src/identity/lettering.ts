// Crest lettering: text set in Barlow Condensed as SVG path data, from the
// letter outlines in glyphs.json (written by scripts/crest-glyphs.py).
//
// Crests are shown with <img>, which can't use the page's fonts, so every
// letter is a shape. Text is either set on a straight line or bent around a
// circle (the ring of a roundel). The result is one compact path per piece of
// text, with every transform already applied to the numbers.
//
// Sizes are given as CAP HEIGHT in crest units, not font size, so "8 units
// tall" means the capitals really are 8 units tall whatever the font's
// proportions. Optical rules shared by every crest live in OPTICAL below.
import glyphData from "./glyphs.json" with { type: "json" };

export type Weight = "600" | "700";

interface Glyph {
  advance: number;
  d: string;
}
interface FontData {
  unitsPerEm: number;
  capHeight: number;
  glyphs: Record<string, Glyph>;
  kern: Record<string, number>;
}

const FONTS = glyphData.weights as Record<Weight, FontData>;

/** Shared lettering rules, so every crest's text has the same colour and rhythm. */
export const OPTICAL = {
  /** Extra space between capitals, as a share of the cap height. Small caps
   *  in a condensed face need air to stay readable at 32 px. */
  tracking: 0.12,
  /** Below this cap height (in a 120-unit crest) text turns to mush when the
   *  crest is shown at 40 px, so the generator refuses it. */
  minCap: 6,
} as const;

export class LetteringError extends Error {
  override name = "LetteringError";
}

/** A point transform: font units in, crest units out. */
type Map2 = (x: number, y: number) => [number, number];

const r1 = (v: number) => {
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s === "-0" ? "0" : s;
};

/** Parse a glyph path (absolute M L H V Q C Z, with implicit repeats, as
 *  fontTools writes it) and write it again with every point mapped. */
export function mapPath(d: string, map: Map2): string {
  const tokens = d.match(/[MLHVQCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const out: string[] = [];
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  const num = () => Number(tokens[i++]);
  const pt = (px: number, py: number) => {
    const [mx, my] = map(px, py);
    return `${r1(mx)} ${r1(my)}`;
  };
  while (i < tokens.length) {
    const t = tokens[i] ?? "";
    if (/^[A-Za-z]$/.test(t)) {
      cmd = t;
      i++;
      if (cmd === "Z" || cmd === "z") {
        out.push("Z");
        continue;
      }
    } else if (cmd === "M") {
      cmd = "L"; // numbers after a moveto's first pair are linetos
    }
    switch (cmd) {
      case "M":
        x = num();
        y = num();
        out.push(`M${pt(x, y)}`);
        break;
      case "L":
        x = num();
        y = num();
        out.push(`L${pt(x, y)}`);
        break;
      case "H":
        x = num();
        out.push(`L${pt(x, y)}`);
        break;
      case "V":
        y = num();
        out.push(`L${pt(x, y)}`);
        break;
      case "Q": {
        const c = pt(num(), num());
        x = num();
        y = num();
        out.push(`Q${c} ${pt(x, y)}`);
        break;
      }
      case "C": {
        const c1 = pt(num(), num());
        const c2 = pt(num(), num());
        x = num();
        y = num();
        out.push(`C${c1} ${c2} ${pt(x, y)}`);
        break;
      }
      default:
        throw new LetteringError(`glyph path command "${cmd}" is not handled`);
    }
  }
  return out.join("");
}

function font(weight: Weight): FontData {
  return FONTS[weight];
}

function glyph(f: FontData, ch: string): Glyph {
  const g = f.glyphs[ch];
  if (!g) throw new LetteringError(`no outline for "${ch}": add it to CHARS in scripts/crest-glyphs.py`);
  return g;
}

/** Each character's outline and left edge, in font units, with kerning and tracking. */
function layout(
  text: string,
  f: FontData,
  trackingUnits: number,
): { placed: { d: string; x: number }[]; width: number } {
  const placed: { d: string; x: number }[] = [];
  let x = 0;
  let previous = "";
  for (const ch of text) {
    if (previous !== "") x += (f.kern[previous + ch] ?? 0) + trackingUnits;
    const g = glyph(f, ch);
    placed.push({ d: g.d, x });
    x += g.advance;
    previous = ch;
  }
  return { placed, width: x };
}

export interface LineOptions {
  /** Centre of the text, and its baseline, in crest units. */
  x: number;
  baseline: number;
  /** Height of the capitals, in crest units. */
  cap: number;
  weight?: Weight;
  /** Extra letter spacing as a share of the cap height (default OPTICAL.tracking). */
  tracking?: number;
  /** The text is narrowed (never below 0.8 of its width) and then shrunk to fit. */
  maxWidth?: number;
}

export interface SetText {
  d: string;
  /** Width and cap height actually used, after any fitting. */
  width: number;
  cap: number;
}

/** Text on a straight line, centred on x. */
export function lineText(text: string, o: LineOptions): SetText {
  const f = font(o.weight ?? "700");
  let cap = o.cap;
  let scale = cap / f.capHeight;
  const tracking = (o.tracking ?? OPTICAL.tracking) * f.capHeight;
  const { placed, width } = layout(text.toUpperCase(), f, tracking);
  // Fit: narrow the letters a little first (condensed faces take it well),
  // then make them smaller.
  let squeeze = 1;
  if (o.maxWidth !== undefined && width * scale > o.maxWidth) {
    squeeze = Math.max(0.8, o.maxWidth / (width * scale));
    if (width * scale * squeeze > o.maxWidth) {
      scale = o.maxWidth / (width * squeeze);
      cap = scale * f.capHeight;
    }
  }
  if (cap < OPTICAL.minCap) throw new LetteringError(`"${text}" would be ${cap.toFixed(1)} units tall`);
  const left = o.x - (width * scale * squeeze) / 2;
  const d = placed
    .map((g) => mapPath(g.d, (gx, gy) => [left + (g.x + gx) * scale * squeeze, o.baseline + gy * scale]))
    .join("");
  return { d, width: width * scale * squeeze, cap };
}

export interface ArcOptions {
  cx: number;
  cy: number;
  /** Radius of the circle through the middle of the capitals (the middle of a roundel's ring). */
  r: number;
  cap: number;
  /** "top" reads left to right over the top; "bottom" reads left to right under the bottom. */
  side: "top" | "bottom";
  weight?: Weight;
  tracking?: number;
  /** Largest angle the text may cover, in degrees (it is shrunk to fit). */
  maxSweep?: number;
}

/** Text bent around a circle, centred on the top or bottom of the ring.
 *  Each letter stands upright on the circle: its own x is mapped along the
 *  arc and its height along the radius, so letters fan out like a real
 *  engraved ring rather than leaning. */
export function arcText(text: string, o: ArcOptions): SetText {
  const f = font(o.weight ?? "700");
  let cap = o.cap;
  let scale = cap / f.capHeight;
  const tracking = (o.tracking ?? OPTICAL.tracking) * f.capHeight;
  const { placed, width } = layout(text.toUpperCase(), f, tracking);
  // Length along the middle circle that the text may take.
  const maxLen = ((o.maxSweep ?? 150) / 180) * Math.PI * o.r;
  if (width * scale > maxLen) {
    scale = maxLen / width;
    cap = scale * f.capHeight;
  }
  if (cap < OPTICAL.minCap) throw new LetteringError(`"${text}" would be ${cap.toFixed(1)} units tall`);
  const total = width * scale;
  const top = o.side === "top";
  const d = placed
    .map((g) =>
      mapPath(g.d, (gx, gy) => {
        // Distance along the arc from the text's centre, and height above the baseline.
        const along = (g.x + gx) * scale - total / 2;
        const up = -gy * scale; // font y points down here, so up is -gy
        // The circle runs through the middle of the capitals. Top: letters
        // stand on the inside, tops outwards. Bottom: tops point to the
        // centre, so the text still reads left to right, the right way up.
        const radius = top ? o.r - cap / 2 + up : o.r + cap / 2 - up;
        const angle = top ? along / o.r - Math.PI / 2 : Math.PI / 2 - along / o.r;
        return [o.cx + radius * Math.cos(angle), o.cy + radius * Math.sin(angle)];
      }),
    )
    .join("");
  return { d, width: total, cap };
}
