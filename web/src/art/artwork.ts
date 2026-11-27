// TableTalk's own football artwork: a stadium stand, a pitch seen from above
// and a goal net. Plain SVG strings built at build time, drawn with simple
// shapes so each stays small (tests/unit/artwork.test.ts checks the sizes).
//
// The pictures never depict a real ground: the stand is a generic cantilever
// stand, the same for every club.
//
// Colours are NOT in the SVG. Every shape has a class (a-*) and
// src/styles/art.css colours it from the theme's --art-* tokens, or, in the
// "band" tone, from the band's ink at --band-art-share, so text on top of the
// artwork keeps its contrast. The SVG is decorative: aria-hidden, no title.

export type ArtName = "stadium" | "pitch" | "goal-net";

/**
 * scene: full colour, for the page background (home hero).
 * lines: outline only in --pitch-line, quiet enough to sit beside text.
 * band:  one faint tone of the band's ink, for inside a brand or club band.
 */
export type ArtTone = "scene" | "lines" | "band";

export const ART_SIZE: Readonly<Record<ArtName, { width: number; height: number }>> = {
  stadium: { width: 640, height: 220 },
  pitch: { width: 300, height: 200 },
  "goal-net": { width: 240, height: 140 },
};

const n = (x: number) => String(Math.round(x * 10) / 10);

function stadium(): string {
  const parts: string[] = [];
  parts.push(`<rect class="a-sky" width="640" height="220"/>`);

  // Floodlight pylons stand beyond the ends of the stand, so in the band tone
  // no two shapes overlap (overlaps would double the tint behind text).
  for (const x of [44, 596]) {
    parts.push(`<circle class="a-glow a-glow-wide" cx="${x}" cy="39" r="62"/>`);
    parts.push(`<circle class="a-glow" cx="${x}" cy="39" r="28"/>`);
    parts.push(`<rect class="a-mast" x="${x - 3}" y="50" width="6" height="120"/>`);
    parts.push(`<rect class="a-lamp" x="${x - 18}" y="28" width="36" height="20" rx="2"/>`);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        parts.push(
          `<rect class="a-bulb" x="${x - 15 + col * 11}" y="${31 + row * 8}" width="8" height="5" rx="1"/>`,
        );
      }
    }
  }

  // Cantilever roof and a stand that widens towards the pitch.
  const top = { y: 78, left: 96, right: 544 };
  const bottom = { y: 170, left: 72, right: 568 };
  const xAt = (side: "left" | "right", y: number) =>
    top[side] + ((bottom[side] - top[side]) * (y - top.y)) / (bottom.y - top.y);
  parts.push(`<polygon class="a-roof" points="104,62 536,62 556,${top.y} 84,${top.y}"/>`);
  parts.push(
    `<polygon class="a-stand" points="${top.left},${top.y} ${top.right},${top.y} ${bottom.right},${bottom.y} ${bottom.left},${bottom.y}"/>`,
  );
  // Rows of seats, then gangways cutting through them.
  const rows: string[] = [];
  for (let y = 92; y < bottom.y; y += 13) rows.push(`M${n(xAt("left", y))} ${y}H${n(xAt("right", y))}`);
  parts.push(`<path class="a-rows" d="${rows.join("")}"/>`);
  const gangways: string[] = [];
  for (const share of [0.2, 0.4, 0.6, 0.8]) {
    const xTop = top.left + (top.right - top.left) * share;
    const xBottom = bottom.left + (bottom.right - bottom.left) * share;
    gangways.push(`M${n(xTop)} ${top.y}L${n(xBottom)} ${bottom.y}`);
  }
  parts.push(`<path class="a-gangway" d="${gangways.join("")}"/>`);

  // The pitch in front: mown stripes, touchline, halfway line, centre circle.
  parts.push(`<rect class="a-pitch" y="170" width="640" height="50"/>`);
  for (let x = 0; x < 640; x += 80)
    parts.push(`<rect class="a-stripe" x="${x}" y="170" width="40" height="50"/>`);
  parts.push(
    `<path class="a-lines" d="M0 178H640M320 178V220M260 205a60 16 0 0 1 120 0"/>`,
    `<path class="a-lines" d="M612 178V150"/><polygon class="a-flag" points="612,150 630,156 612,162"/>`,
  );
  return parts.join("");
}

function pitch(): string {
  const box = (x: number, w: number, y: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}`;
  const lines = [
    "M10 10h280v180H10z", // touchlines and goal lines
    "M150 10v180", // halfway line
    "M178 100a28 28 0 1 0 -56 0a28 28 0 1 0 56 0", // centre circle
    box(10, 44, 55, 90),
    box(10, 16, 80, 40),
    box(290, -44, 55, 90),
    box(290, -16, 80, 40),
    "M54 86a18 18 0 0 1 0 28", // penalty arcs
    "M246 86a18 18 0 0 0 0 28",
  ].join("");
  const stripes: string[] = [];
  for (let x = 10; x < 290; x += 56)
    stripes.push(`<rect class="a-stripe" x="${x}" y="10" width="28" height="180"/>`);
  return [
    `<rect class="a-pitch" x="10" y="10" width="280" height="180"/>`,
    ...stripes,
    `<path class="a-lines" d="${lines}"/>`,
    `<circle class="a-spot" cx="150" cy="100" r="2.5"/>`,
    `<circle class="a-spot" cx="40" cy="100" r="2"/>`,
    `<circle class="a-spot" cx="260" cy="100" r="2"/>`,
  ].join("");
}

function goalNet(): string {
  const mesh: string[] = [];
  for (let x = 32; x < 220; x += 12) mesh.push(`M${x} 26V130`);
  for (let y = 38; y < 130; y += 12) mesh.push(`M26 ${y}H214`);
  return [
    `<path class="a-net" d="${mesh.join("")}"/>`,
    `<path class="a-ground" d="M0 131H240"/>`,
    `<path class="a-frame" d="M20 131V20H220V131"/>`,
  ].join("");
}

const DRAW: Record<ArtName, () => string> = { stadium, pitch, "goal-net": goalNet };

/** The complete <svg> element. Width and height reserve its space before it
 *  is drawn; CSS scales it from there (art.css). */
export function artSvg(name: ArtName, tone: ArtTone): string {
  const { width, height } = ART_SIZE[name];
  return (
    `<svg class="art art-${name}" data-tone="${tone}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"` +
    ` preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${DRAW[name]()}</svg>`
  );
}
