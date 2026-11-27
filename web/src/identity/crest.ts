// Drawing a crest: a club's design (a short function in a league file, such
// as premier-league.ts) gets a Kit of shared pieces and returns the parts of
// its crest, back to front. The Kit handles the technical side the same way
// for every club (the 120-unit box, keyline and rim, clipping, lettering,
// rounding); the design decides the composition. That keeps the collection
// consistent without making every club the same shape.
import { arcText, lineText, type ArcOptions, type LineOptions } from "./lettering.ts";
import {
  BOX,
  band,
  disc,
  pattern,
  ring,
  rule,
  shield,
  star,
  type Pattern,
  type ShapeName,
} from "./primitives.ts";
import { place, type Ink, type Placement, type SymbolName } from "./symbols.ts";

export interface Kit {
  /** The outline, its rim and its field. Patterns drawn after it stay inside the field. */
  shield(shape: ShapeName, o: { rim: string; field: string; rimWidth?: number }): string;
  pattern(p: Pattern): string;
  symbol(name: SymbolName, at: Placement, ink: Ink): string;
  /** Text on a straight line, centred on x. */
  text(text: string, o: LineOptions & { fill: string }): string;
  /** Text round a roundel's ring. */
  arc(text: string, o: Omit<ArcOptions, "cx" | "cy"> & { fill: string }): string;
  ring: typeof ring;
  disc: typeof disc;
  star: typeof star;
  /** A band across the field, clipped to it. */
  band(y: number, h: number, fill: string): string;
  rule(y: number, fill: string, h?: number): string;
}

/** A crest design: given the Kit, the crest's parts from back to front. */
export type Design = (k: Kit) => string[];

function kit(clip: string): Kit {
  return {
    shield: (shape, o) => shield(shape, { ...o, clip }),
    pattern: (p) => pattern(p, clip),
    symbol: place,
    text: (text, o) => `<path d="${lineText(text, o).d}" fill="${o.fill}"/>`,
    arc: (text, o) => `<path d="${arcText(text, { ...o, cx: BOX / 2, cy: BOX / 2 }).d}" fill="${o.fill}"/>`,
    ring,
    disc,
    star,
    band: (y, h, fill) => band(y, h, fill, clip),
    rule: (y, fill, h) => rule(y, fill, clip, h),
  };
}

/**
 * The complete SVG document for a design. `id` keeps the clip path's id
 * unique when a crest is written into a page (the fallback crest); a crest
 * file served on its own can use any id.
 */
export function renderCrest(design: Design, id = "f"): string {
  const body = design(kit(id)).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX} ${BOX}" width="${BOX}" height="${BOX}">` +
    `${body}</svg>`
  );
}

// The fallback crest -------------------------------------------------------
//
// For a club with no entry in the registry yet, such as a newly promoted
// club the night its first fixtures arrive. The build doesn't stop (the
// nightly build publishes the data, so a missing crest must never block
// it); it warns and draws this instead: a plain grey shield with the club's
// initials and a dashed inner line, clearly a placeholder and never a guess
// at the club's colours.

const FALLBACK = { rim: "#5b6470", field: "#e6e8ea", ink: "#3c4450", dash: "#8a929c" } as const;

/** Words that say what kind of club it is, not which club. */
const CLUB_WORDS = new Set([
  "FC",
  "AFC",
  "CF",
  "SC",
  "SV",
  "AC",
  "AS",
  "SS",
  "SSC",
  "US",
  "RC",
  "CD",
  "UD",
  "SD",
  "TSG",
  "VFB",
  "VFL",
  "RB",
  "FSV",
  "BSC",
  "OGC",
  "1",
]);

/** Up to three letters for a club's fallback crest: "Hamburger SV" -> "HAM", "Paris FC" -> "PAR",
 *  "Borussia Mönchengladbach" -> "BM". Accents are dropped; anything else outside A-Z and 0-9 too. */
export function initials(name: string): string {
  const words = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((w) => w !== "" && !CLUB_WORDS.has(w) && !/^\d+$/.test(w));
  if (words.length === 0) return "?";
  const [only] = words;
  if (words.length === 1 && only !== undefined) return only.slice(0, 3);
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("");
}

export function fallbackDesign(name: string, size: "full" | "small"): Design {
  const letters = initials(name);
  return (k) => [
    k.shield("heater", { rim: FALLBACK.rim, field: FALLBACK.field, rimWidth: size === "small" ? 7 : 4 }),
    `<path d="M24 16L96 16L96 50C96 76 80 94 60 104C40 94 24 76 24 50Z" fill="none" stroke="${FALLBACK.dash}" stroke-width="2" stroke-dasharray="5 4"/>`,
    ...(letters === "?"
      ? []
      : [
          k.text(letters, {
            x: 60,
            baseline: size === "small" ? 72 : 68,
            cap: size === "small" ? 30 : 22,
            maxWidth: 62,
            fill: FALLBACK.ink,
          }),
        ]),
  ];
}
