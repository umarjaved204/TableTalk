"""Barlow Condensed letter outlines for the crests (src/identity/glyphs.json).

Crests are shown with <img>, and an SVG shown that way can't use the page's
fonts. So the lettering on a crest ("ARSENAL", "1886") has to be drawn as
shapes. This script reads the outlines of the capital letters, digits and a
few marks from the site's own Barlow Condensed files (SIL Open Font
License) and writes them, with their widths and kerning, to a JSON file. The
crest generator (src/identity/lettering.ts) then sets any text from that
file in plain TypeScript, at build time, with no font tool.

Run it again only if the font package changes or a crest needs a character
that isn't in the file yet (add it to CHARS). Nothing in the site depends on
Python or fontTools: only the JSON it writes is committed.

    python -m venv .crest-venv          (anywhere outside the repo is fine)
    .crest-venv/Scripts/python -m pip install -r scripts/crest-glyphs.requirements.txt
    .crest-venv/Scripts/python scripts/crest-glyphs.py      (run from web/)

The output is the same on every run for the same font files, so a re-run
that changes nothing leaves git with nothing to commit.
"""

import json
import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

WEB = Path(__file__).resolve().parent.parent
FONT_DIR = WEB / "node_modules" / "@fontsource" / "barlow-condensed" / "files"
OUT = WEB / "src" / "identity" / "glyphs.json"

# WOFF (not WOFF2): fontTools reads it without the brotli package.
WEIGHTS = {"600": "barlow-condensed-latin-600-normal.woff", "700": "barlow-condensed-latin-700-normal.woff"}

# Capitals, digits, and the marks a crest might carry. Accented capitals are
# here for club names such as "ATLÉTICO" and "KÖLN", and a lowercase f for
# the VfB of VfB Stuttgart.
CHARS = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "0123456789"
    " &.-'·"
    "ÁÀÂÄÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕØÚÙÛÜ"
    "f"
)


def outline(font, glyph_name):
    """The glyph as SVG path data, y pointing down (SVG), baseline at y=0."""
    glyph_set = font.getGlyphSet()
    pen = SVGPathPen(glyph_set, ntos=lambda v: str(round(v)))
    glyph_set[glyph_name].draw(TransformPen(pen, (1, 0, 0, -1, 0, 0)))
    return pen.getCommands()


def kerning(font, names):
    """Pair kerning between the chosen glyphs, from the GPOS 'kern' feature.

    Handles both pair formats: single pairs (format 1) and class pairs
    (format 2). Only horizontal advance adjustments are used.
    """
    wanted = set(names)
    pairs = {}
    gpos = font["GPOS"].table
    kern_lookups = set()
    for record in gpos.FeatureList.FeatureRecord:
        if record.FeatureTag == "kern":
            kern_lookups.update(record.Feature.LookupListIndex)
    for index in sorted(kern_lookups):
        lookup = gpos.LookupList.Lookup[index]
        for sub in lookup.SubTable:
            if lookup.LookupType == 9:  # extension: the real subtable is inside
                sub = sub.ExtSubTable
            if getattr(sub, "Format", None) == 1 and hasattr(sub, "PairSet"):
                for first, pair_set in zip(sub.Coverage.glyphs, sub.PairSet):
                    if first not in wanted:
                        continue
                    for record in pair_set.PairValueRecord:
                        value = getattr(record.Value1, "XAdvance", 0) or 0
                        if record.SecondGlyph in wanted and value:
                            pairs.setdefault((first, record.SecondGlyph), value)
            elif getattr(sub, "Format", None) == 2:
                class1 = sub.ClassDef1.classDefs
                class2 = sub.ClassDef2.classDefs
                for first in sub.Coverage.glyphs:
                    if first not in wanted:
                        continue
                    row = sub.Class1Record[class1.get(first, 0)]
                    for second in wanted:
                        value = getattr(row.Class2Record[class2.get(second, 0)].Value1, "XAdvance", 0) or 0
                        if value:
                            pairs.setdefault((first, second), value)
    return pairs


def main():
    out = {
        "source": "Barlow Condensed (SIL Open Font License 1.1), from @fontsource/barlow-condensed; written by scripts/crest-glyphs.py",
        "weights": {},
    }
    for weight, file_name in WEIGHTS.items():
        font = TTFont(FONT_DIR / file_name)
        cmap = font.getBestCmap()
        hmtx = font["hmtx"]
        missing = [c for c in CHARS if ord(c) not in cmap]
        if missing:
            sys.exit(f"{file_name} has no glyph for: {''.join(missing)}")
        names = {c: cmap[ord(c)] for c in CHARS}
        glyphs = {c: {"advance": hmtx[name][0], "d": outline(font, name)} for c, name in names.items()}
        by_name = {name: c for c, name in names.items()}
        kern = {
            by_name[a] + by_name[b]: value
            for (a, b), value in sorted(kerning(font, list(names.values())).items())
        }
        out["weights"][weight] = {
            "unitsPerEm": font["head"].unitsPerEm,
            "capHeight": font["OS/2"].sCapHeight,
            "glyphs": glyphs,
            "kern": dict(sorted(kern.items())),
        }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(WEB)}: {len(CHARS)} characters x {len(WEIGHTS)} weights")


if __name__ == "__main__":
    main()
