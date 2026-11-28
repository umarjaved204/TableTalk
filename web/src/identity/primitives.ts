// Reusable drawing pieces for the crests: outlines, rims, field patterns,
// ribbons and small marks. Every crest is drawn in the same 120 x 120 box,
// so the collection lines up in a table row without per-club sizing.
//
// The outlines are drawn to look the same size, not to measure the same:
// a circle looks smaller than a shield of the same height, so roundels are
// a little larger (optical sizing). Rim and keyline widths are shared
// (STROKE), so every crest has the same weight of edge.
//
// Everything returns plain SVG markup strings. Colours are written as fill
// attributes (allowed by the site's Content Security Policy; style="" is not).

export const BOX = 120;
const C = BOX / 2;

/** Shared edge weights, in crest units (120 = the crest's full height). */
export const STROKE = {
  /** White outline round the whole crest, so dark crests stand out on dark themes. */
  keyline: 5,
  /** The coloured rim inside the keyline. */
  rim: 4,
  /** Small variant: everything heavier, as it is shown at 16 to 24 px. */
  smallRim: 7,
  /** Fine detail lines (spokes, mullions). */
  detail: 2.5,
} as const;

export type ShapeName =
  | "heater"
  | "english"
  | "french"
  | "angular"
  | "roundel"
  | "oval"
  | "arch"
  | "badge"
  | "tablet"
  | "crowned-roundel"
  | "triangle"
  | "lobed"
  | "diamond"
  | "catalan"
  | "tall-diamond"
  | "tapered"
  | "egg"
  | "rhombus"
  | "soft-diamond"
  | "peaked"
  | "block"
  | "plate"
  | "medallion"
  | "flag";

const r1 = (v: number) => String(Math.round(v * 10) / 10);
const pts = (list: [number, number][]) => list.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L");

/**
 * The outline of each shape, inset by `i` units (0 = the outer edge). Insets
 * give the rim: the outline at 0 filled with the rim colour, then the outline
 * at STROKE.rim filled with the field.
 */
export const SHAPES: Readonly<Record<ShapeName, (i: number) => string>> = {
  // The classic heater shield: flat top, straight sides, curving to a point.
  heater(i) {
    const top = 6 + i;
    const hw = 47 - i;
    const tip = 115 - i * 1.4;
    const l = C - hw;
    const r = C + hw;
    return (
      `M${r1(l)} ${r1(top)}L${r1(r)} ${r1(top)}L${r1(r)} 50` +
      `C${r1(r)} 80 ${r1(C + hw * 0.55)} 101 60 ${r1(tip)}` +
      `C${r1(C - hw * 0.55)} 101 ${r1(l)} 80 ${r1(l)} 50Z`
    );
  },
  // Round-bottomed (Iberian) shield: straight sides into a full curve.
  english(i) {
    const top = 7 + i;
    const hw = 45 - i;
    const base = 114 - i;
    const l = C - hw;
    const r = C + hw;
    return (
      `M${r1(l)} ${r1(top)}L${r1(r)} ${r1(top)}L${r1(r)} 66` +
      `C${r1(r)} ${r1(66 + hw * 0.75)} ${r1(C + hw * 0.55)} ${r1(base)} 60 ${r1(base)}` +
      `C${r1(C - hw * 0.55)} ${r1(base)} ${r1(l)} ${r1(66 + hw * 0.75)} ${r1(l)} 66Z`
    );
  },
  // French shield: square shoulders, straight sides and a small ogee point.
  french(i) {
    const top = 7 + i;
    const hw = 45 - i;
    const tip = 115 - i * 1.3;
    const l = C - hw;
    const r = C + hw;
    const foot = 92 - i * 0.4;
    return (
      `M${r1(l)} ${r1(top)}L${r1(r)} ${r1(top)}L${r1(r)} ${r1(foot)}` +
      `Q${r1(r)} ${r1(foot + 10)} ${r1(C + 14)} ${r1(foot + 11)}Q60 ${r1(foot + 12)} 60 ${r1(tip)}` +
      `Q60 ${r1(foot + 12)} ${r1(C - 14)} ${r1(foot + 11)}Q${r1(l)} ${r1(foot + 10)} ${r1(l)} ${r1(foot)}Z`
    );
  },
  // Angular badge: cut top corners and a long straight-sided point.
  angular(i) {
    const top = 6 + i;
    const hw = 47 - i;
    const cut = 11 - i * 0.4;
    const shoulder = 72 - i * 0.2;
    const tip = 115 - i * 1.6;
    return `M${pts([
      [C - hw + cut, top],
      [C + hw - cut, top],
      [C + hw, top + cut],
      [C + hw, shoulder],
      [C, tip],
      [C - hw, shoulder],
      [C - hw, top + cut],
    ])}Z`;
  },
  // A circle, a little larger than the shields' width so it looks the same size.
  roundel(i) {
    const r = 57 - i;
    return `M${r1(C - r)} 60A${r1(r)} ${r1(r)} 0 1 1 ${r1(C + r)} 60A${r1(r)} ${r1(r)} 0 1 1 ${r1(C - r)} 60Z`;
  },
  // An upright oval, like the old cartouche badges.
  oval(i) {
    const rx = 46 - i;
    const ry = 57 - i;
    return `M${r1(C - rx)} 60A${r1(rx)} ${r1(ry)} 0 1 1 ${r1(C + rx)} 60A${r1(rx)} ${r1(ry)} 0 1 1 ${r1(C - rx)} 60Z`;
  },
  // A round-topped arch over straight sides and a pointed base, like a
  // window in a Spanish church front.
  arch(i) {
    const hw = 44 - i;
    const top = 6 + i;
    const spring = top + hw;
    const tip = 115 - i * 1.4;
    return (
      `M${r1(C - hw)} ${r1(spring)}A${r1(hw)} ${r1(hw)} 0 0 1 ${r1(C + hw)} ${r1(spring)}` +
      `L${r1(C + hw)} 78Q${r1(C + hw)} 96 60 ${r1(tip)}Q${r1(C - hw)} 96 ${r1(C - hw)} 78Z`
    );
  },
  // A five-sided badge: flat top, straight sides, two straight edges meeting
  // at a broad point.
  badge(i) {
    const hw = 47 - i;
    const top = 8 + i;
    const shoulder = 76 - i * 0.3;
    const tip = 114 - i * 1.5;
    return `M${pts([
      [C - hw, top],
      [C + hw, top],
      [C + hw, shoulder],
      [C, tip],
      [C - hw, shoulder],
    ])}Z`;
  },
  // A circle set low in the box, leaving room for a crown above it.
  "crowned-roundel"(i) {
    const r = 45 - i;
    const cy = 71;
    return `M${r1(C - r)} ${cy}A${r1(r)} ${r1(r)} 0 1 1 ${r1(C + r)} ${cy}A${r1(r)} ${r1(r)} 0 1 1 ${r1(C - r)} ${cy}Z`;
  },
  // An inverted triangle with gently curved sides, its top set low enough
  // for a crown above it.
  triangle(i) {
    const top = 32 + i;
    const l = 12 + i * 1.3;
    const r = BOX - l;
    const tip = 116 - i * 1.8;
    return `M${r1(l)} ${r1(top)}L${r1(r)} ${r1(top)}Q${r1(r - 6)} 78 60 ${r1(tip)}Q${r1(l + 6)} 78 ${r1(l)} ${r1(top)}Z`;
  },
  // A shield with two rounded lobes at the top meeting in a dip, rounding
  // down to a point: a heart-like outline.
  lobed(i) {
    const hw = 46 - i;
    const l = C - hw;
    const r = C + hw;
    const dip = 18 + i;
    const tip = 115 - i * 1.4;
    return (
      `M60 ${r1(dip)}C${r1(C - 10)} ${r1(6 + i)} ${r1(l)} ${r1(4 + i)} ${r1(l)} ${r1(28)}L${r1(l)} 58` +
      `C${r1(l)} ${r1(86 - i * 0.6)} ${r1(C - 22 + i * 0.4)} ${r1(102 - i * 1.2)} 60 ${r1(tip)}C${r1(C + 22 - i * 0.4)} ${r1(102 - i * 1.2)} ${r1(r)} ${r1(86 - i * 0.6)} ${r1(r)} 58L${r1(r)} 28` +
      `C${r1(r)} ${r1(4 + i)} ${r1(C + 10)} ${r1(6 + i)} 60 ${r1(dip)}Z`
    );
  },
  // A diamond standing on its point.
  diamond(i) {
    const e = 4 + i * 1.4;
    return `M60 ${r1(e)}L${r1(BOX - e)} 60L60 ${r1(BOX - e)}L${r1(e)} 60Z`;
  },
  // A Catalan-style shield: rounded lobes at the two top corners rising to a
  // point at the centre, full sides, and a pointed base.
  catalan(i) {
    const hw = 46 - i;
    const l = C - hw;
    const r = C + hw;
    const peak = 15 + i;
    const shoulder = 7 + i;
    const tip = 116 - i * 1.5;
    return (
      `M60 ${r1(peak)}C${r1(C - 12)} ${r1(22 + i)} ${r1(l + 8)} ${r1(shoulder - 4)} ${r1(l)} ${r1(shoulder + 8)}` +
      `C${r1(l - 2)} 50 ${r1(l + 6)} 82 60 ${r1(tip)}C${r1(r - 6)} 82 ${r1(r + 2)} 50 ${r1(r)} ${r1(shoulder + 8)}` +
      `C${r1(r - 8)} ${r1(shoulder - 4)} ${r1(C + 12)} ${r1(22 + i)} 60 ${r1(peak)}Z`
    );
  },

  // A landscape rectangle, about 3:2, with barely rounded corners: a flag,
  // for Hamburg's blue field in its traditional proportions.
  flag(i) {
    const [l, r, t, b] = [4 + i, BOX - 4 - i, 21 + i, BOX - 21 - i];
    const q = Math.max(1, 2.5 - i * 0.3);
    return (
      `M${r1(l + q)} ${r1(t)}L${r1(r - q)} ${r1(t)}Q${r1(r)} ${r1(t)} ${r1(r)} ${r1(t + q)}` +
      `L${r1(r)} ${r1(b - q)}Q${r1(r)} ${r1(b)} ${r1(r - q)} ${r1(b)}L${r1(l + q)} ${r1(b)}` +
      `Q${r1(l)} ${r1(b)} ${r1(l)} ${r1(b - q)}L${r1(l)} ${r1(t + q)}Q${r1(l)} ${r1(t)} ${r1(l + q)} ${r1(t)}Z`
    );
  },
  // A square block with slightly rounded corners: Hamburg's blue field.
  block(i) {
    const a = 8 + i;
    const b = BOX - a;
    const r = Math.max(1.5, 4 - i * 0.5);
    return (
      `M${r1(a + r)} ${r1(a)}L${r1(b - r)} ${r1(a)}Q${r1(b)} ${r1(a)} ${r1(b)} ${r1(a + r)}` +
      `L${r1(b)} ${r1(b - r)}Q${r1(b)} ${r1(b)} ${r1(b - r)} ${r1(b)}L${r1(a + r)} ${r1(b)}` +
      `Q${r1(a)} ${r1(b)} ${r1(a)} ${r1(b - r)}L${r1(a)} ${r1(a + r)}Q${r1(a)} ${r1(a)} ${r1(a + r)} ${r1(a)}Z`
    );
  },
  // A slanted horizontal plate across the lower half of the box, for a
  // lettering-led emblem (Union Berlin) rather than a shield or roundel.
  plate(i) {
    const top = 58 + i;
    const bottom = 102 - i;
    const slant = 10;
    return `M${r1(4 + slant + i)} ${r1(top)}L${r1(116 - i)} ${r1(top)}L${r1(116 - slant - i)} ${r1(bottom)}L${r1(4 + i)} ${r1(bottom)}Z`;
  },
  // A small medallion in the middle of the box, for a badge whose supporters
  // and banners stand outside it (Leverkusen).
  medallion(i) {
    const r = 26 - i;
    const cy = 56;
    return `M${r1(C - r)} ${cy}A${r1(r)} ${r1(r)} 0 1 1 ${r1(C + r)} ${cy}A${r1(r)} ${r1(r)} 0 1 1 ${r1(C - r)} ${cy}Z`;
  },
  // A tall rhombus filling the box's height: Gladbach's traditional outline.
  rhombus(i) {
    const e = i * 1.25;
    return `M60 ${r1(3 + e)}L${r1(103 - i * 0.8)} 60L60 ${r1(117 - e)}L${r1(17 + i * 0.8)} 60Z`;
  },
  // A square-on diamond with rounded corners: Werder Bremen's outline.
  "soft-diamond"(i) {
    const e = 5 + i * 1.4;
    const k = 7 - i * 0.25;
    const p = (x: number, y: number) => `${r1(x)} ${r1(y)}`;
    return (
      `M${p(60 - k, e + k)}Q60 ${r1(e - 1)} ${p(60 + k, e + k)}L${p(BOX - e - k, 60 - k)}` +
      `Q${r1(BOX - e + 1)} 60 ${p(BOX - e - k, 60 + k)}L${p(60 + k, BOX - e - k)}` +
      `Q60 ${r1(BOX - e + 1)} ${p(60 - k, BOX - e - k)}L${p(e + k, 60 + k)}` +
      `Q${r1(e - 1)} 60 ${p(e + k, 60 - k)}Z`
    );
  },
  // A shield rising to a point at the top centre, with sloping shoulders,
  // sides that swell and a point below: Hoffenheim's traditional outline.
  peaked(i) {
    const top = 5 + i * 1.3;
    const l = 7 + i;
    const r = BOX - l;
    const sh = 28 + i * 0.4;
    const tip = 116 - i * 1.5;
    return (
      `M60 ${r1(top)}Q${r1(C + 24)} ${r1(top + 14)} ${r1(r)} ${r1(sh)}` +
      `C${r1(r + 2)} ${r1(60)} ${r1(r - 4)} 86 ${r1(C + 16)} 100L60 ${r1(tip)}L${r1(C - 16)} 100` +
      `C${r1(l + 4)} 86 ${r1(l - 2)} 60 ${r1(l)} ${r1(sh)}Q${r1(C - 24)} ${r1(top + 14)} 60 ${r1(top)}Z`
    );
  },
  // A tall, narrow diamond set low, for a crown above and a circle behind it.
  "tall-diamond"(i) {
    const e = i * 1.6;
    return `M60 ${r1(24 + e)}L${r1(93 - i)} 70L60 ${r1(117 - e)}L${r1(27 + i)} 70Z`;
  },
  // A broad shield with a straight top, set low for a crown above it, its
  // sides tapering in long curves to a point.
  tapered(i) {
    const top = 30 + i;
    const l = 8 + i;
    const r = BOX - l;
    const tip = 117 - i * 1.6;
    return (
      `M${r1(l)} ${r1(top)}Q60 ${r1(top - 6)} ${r1(r)} ${r1(top)}` +
      `C${r1(r - 2)} 70 ${r1(C + 22 - i * 0.3)} 100 60 ${r1(tip)}C${r1(C - 22 + i * 0.3)} 100 ${r1(l + 2)} 70 ${r1(l)} ${r1(top)}Z`
    );
  },
  // A tall egg-shaped shield: rounded top, full sides, tapering to a point.
  egg(i) {
    const top = 10 + i;
    const hw = 44 - i;
    const tip = 117 - i * 1.6;
    return (
      `M60 ${r1(top)}C${r1(C + hw * 0.9)} ${r1(top)} ${r1(C + hw)} 34 ${r1(C + hw)} 58` +
      `C${r1(C + hw)} 84 ${r1(C + 14)} 104 60 ${r1(tip)}C${r1(C - 14)} 104 ${r1(C - hw)} 84 ${r1(C - hw)} 58` +
      `C${r1(C - hw)} 34 ${r1(C - hw * 0.9)} ${r1(top)} 60 ${r1(top)}Z`
    );
  },
  // A rounded rectangle, a little taller than wide.
  tablet(i) {
    const hw = 46 - i;
    const top = 6 + i;
    const bottom = 114 - i;
    const r = Math.max(4, 16 - i);
    const l = C - hw;
    const rr = C + hw;
    return (
      `M${r1(l + r)} ${r1(top)}L${r1(rr - r)} ${r1(top)}Q${r1(rr)} ${r1(top)} ${r1(rr)} ${r1(top + r)}` +
      `L${r1(rr)} ${r1(bottom - r)}Q${r1(rr)} ${r1(bottom)} ${r1(rr - r)} ${r1(bottom)}` +
      `L${r1(l + r)} ${r1(bottom)}Q${r1(l)} ${r1(bottom)} ${r1(l)} ${r1(bottom - r)}` +
      `L${r1(l)} ${r1(top + r)}Q${r1(l)} ${r1(top)} ${r1(l + r)} ${r1(top)}Z`
    );
  },
};

/** A shape filled with its rim and field. `clip` names the clip path that
 *  patterns use to stay inside the field. */
export function shield(
  shape: ShapeName,
  o: { rim: string; field: string; clip: string; rimWidth?: number },
): string {
  const rim = o.rimWidth ?? STROKE.rim;
  const outer = SHAPES[shape](0);
  const inner = SHAPES[shape](rim);
  return (
    `<defs><clipPath id="${o.clip}"><path d="${inner}"/></clipPath></defs>` +
    `<path d="${outer}" fill="#fff" stroke="#fff" stroke-width="${STROKE.keyline}" stroke-linejoin="round"/>` +
    `<path d="${outer}" fill="${o.rim}"/>` +
    `<path d="${inner}" fill="${o.field}"/>`
  );
}

/** Field patterns: drawn over the whole box and clipped to the field. They
 *  support a design; they are never the whole design. */
export type Pattern =
  | { kind: "stripes"; colour: string; count: number; from?: number; to?: number }
  | { kind: "hoops"; colour: string; count: number; from?: number; to?: number }
  | { kind: "halves"; colour: string; side: "left" | "right" }
  | { kind: "sash"; colour: string; width: number; direction?: "down-right" | "down-left" }
  | { kind: "bends"; colour: string; count: number; width: number; gap: number; offset?: number }
  | { kind: "chevron"; colour: string; y: number; width: number; depth: number }
  | { kind: "chief"; colour: string; height: number }
  | { kind: "base"; colour: string; from: number }
  | { kind: "waves"; colour: string; from: number; count: number; gap?: number; width?: number }
  | { kind: "tiger"; colour: string };

export function pattern(p: Pattern, clip: string): string {
  const g = (inner: string) => `<g clip-path="url(#${clip})">${inner}</g>`;
  switch (p.kind) {
    case "stripes": {
      // Vertical stripes, centred so the middle stripe sits on the axis.
      const from = p.from ?? 0;
      const to = p.to ?? BOX;
      const w = (BOX - 8) / p.count;
      const rects: string[] = [];
      for (let k = 1; k < p.count; k += 2)
        rects.push(`<rect x="${r1(4 + k * w)}" y="${from}" width="${r1(w)}" height="${to - from}"/>`);
      return g(`<g fill="${p.colour}">${rects.join("")}</g>`);
    }
    case "hoops": {
      const from = p.from ?? 0;
      const to = p.to ?? BOX;
      const h = (to - from) / p.count;
      const rects: string[] = [];
      for (let k = 1; k < p.count; k += 2)
        rects.push(`<rect x="0" y="${r1(from + k * h)}" width="${BOX}" height="${r1(h)}"/>`);
      return g(`<g fill="${p.colour}">${rects.join("")}</g>`);
    }
    case "halves":
      return g(
        `<rect x="${p.side === "left" ? 0 : C}" y="0" width="${C}" height="${BOX}" fill="${p.colour}"/>`,
      );
    case "sash": {
      const w = p.width / 2;
      const d =
        (p.direction ?? "down-right") === "down-right"
          ? `M${-w} ${-w}L${w} ${-w}L${BOX + w} ${BOX - w}L${BOX + w} ${BOX + w}L${BOX - w} ${BOX + w}L${-w} ${w}Z`
          : `M${BOX - w} ${-w}L${BOX + w} ${-w}L${BOX + w} ${w}L${w} ${BOX + w}L${-w} ${BOX + w}L${-w} ${BOX - w}Z`;
      return g(`<path d="${d}" fill="${p.colour}"/>`);
    }
    case "bends": {
      // Thin parallel bands rising to the right: rivers, in Manchester's arms.
      const bands: string[] = [];
      const offset = p.offset ?? 0;
      for (let k = 0; k < p.count; k++) {
        const y = 70 + offset + (k - (p.count - 1) / 2) * (p.width + p.gap);
        bands.push(`M-10 ${r1(y + 40)}L130 ${r1(y - 40)}`);
      }
      return g(`<path d="${bands.join("")}" stroke="${p.colour}" stroke-width="${p.width}" fill="none"/>`);
    }
    case "chevron": {
      const { y, width: w, depth } = p;
      return g(
        `<path d="M-6 ${r1(y + depth)}L60 ${r1(y)}L126 ${r1(y + depth)}L126 ${r1(y + depth + w)}L60 ${r1(y + w)}L-6 ${r1(y + depth + w)}Z" fill="${p.colour}"/>`,
      );
    }
    case "chief":
      return g(`<rect x="0" y="0" width="${BOX}" height="${p.height}" fill="${p.colour}"/>`);
    case "base":
      return g(`<rect x="0" y="${p.from}" width="${BOX}" height="${BOX - p.from}" fill="${p.colour}"/>`);
    case "waves": {
      const gap = p.gap ?? 7;
      const width = p.width ?? 3;
      const lines: string[] = [];
      for (let k = 0; k < p.count; k++) {
        const y = p.from + k * gap;
        let d = `M-4 ${y}`;
        for (let x = -4; x < BOX + 4; x += 16) d += `q4 -4 8 0t8 0`;
        lines.push(d);
      }
      return g(
        `<path d="${lines.join("")}" stroke="${p.colour}" stroke-width="${width}" fill="none" stroke-linecap="round"/>`,
      );
    }
    case "tiger": {
      // Tapering stripes coming in from both edges, like a tiger's flank.
      const marks: string[] = [];
      for (const [y, len] of [
        [24, 22],
        [40, 28],
        [56, 24],
        [72, 26],
        [88, 20],
      ] as const) {
        marks.push(`M0 ${y - 4}L${len} ${y + 1}L0 ${y + 6}Z`);
        marks.push(`M120 ${y + 2}L${120 - len} ${y + 7}L120 ${y + 12}Z`);
      }
      return g(`<path d="${marks.join("")}" fill="${p.colour}"/>`);
    }
  }
}

/** A five-pointed star, for honours and accents. */
export function star(cx: number, cy: number, r: number, fill: string): string {
  const points: [number, number][] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : r * 0.42;
    points.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return `<path d="M${pts(points)}Z" fill="${fill}"/>`;
}

/** A ring: the band of a roundel that carries the club's name. */
export function ring(r: number, width: number, fill: string): string {
  const o = r + width / 2;
  const i = r - width / 2;
  return (
    `<path fill-rule="evenodd" fill="${fill}" d="M${r1(C - o)} 60A${r1(o)} ${r1(o)} 0 1 1 ${r1(C + o)} 60A${r1(o)} ${r1(o)} 0 1 1 ${r1(C - o)} 60Z` +
    `M${r1(C - i)} 60A${r1(i)} ${r1(i)} 0 1 0 ${r1(C + i)} 60A${r1(i)} ${r1(i)} 0 1 0 ${r1(C - i)} 60Z"/>`
  );
}

/** A disc, e.g. the inner field of a roundel or a plaque behind a symbol. */
export function disc(cx: number, cy: number, r: number, fill: string, stroke?: [string, number]): string {
  const s = stroke ? ` stroke="${stroke[0]}" stroke-width="${stroke[1]}"` : "";
  return `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${fill}"${s}/>`;
}

/** A plain band across the crest (a fess), for a name or a date. */
export function band(y: number, h: number, fill: string, clip: string): string {
  return `<g clip-path="url(#${clip})"><rect x="0" y="${r1(y)}" width="${BOX}" height="${r1(h)}" fill="${fill}"/></g>`;
}

/** A thin line across the crest, e.g. under a chief. */
export function rule(y: number, fill: string, clip: string, h: number = STROKE.detail): string {
  return band(y - h / 2, h, fill, clip);
}
