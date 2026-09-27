"""Fetch official final league tables from Wikipedia, as a test fixture.

    python scripts/fetch_official_tables.py premier_league "{season} Premier League"
    python scripts/fetch_official_tables.py bundesliga "{season} Bundesliga"
    python scripts/fetch_official_tables.py la_liga "{season} La Liga"

Why: rebuilding one official table proves little; rebuilding every season's,
in the right order and with the right points, checks the data, the team-name
mapping, the configured tiebreakers and the points-deductions file all at once.
It already found one deduction that was missing (Almería, La Liga 2014-15).

How: Wikipedia season articles hold the final table in a structured
``{{#invoke:Sports table|...}}`` block (sometimes in a separate template page)
with each club's wins, draws, losses, goals and any points adjustment
(``adjust_points_XXX``), and the finishing order. This script reads that raw
wikitext, maps club names through the project's normaliser, and writes
``tests/data/<competition>_official_tables.csv``. The test suite then compares
against the file offline (``tests/test_official_tables.py``).

Wikipedia is a secondary source, so for a season that disagrees with the rebuilt
table, check the official league source before changing anything.
"""

from __future__ import annotations

import re
import sys
import warnings
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from tabletalk.config import load_competition  # noqa: E402
from tabletalk.data import load_matches  # noqa: E402
from tabletalk.data.normalise import default_normaliser  # noqa: E402
from tabletalk.simulation import league_table  # noqa: E402

#: Where English Wikipedia's table is wrong, the correction and the evidence.
#: Applied after parsing and printed on every run, so nothing is hidden.
CORRECTIONS = {
    ("serie_a", "2017-18"): {
        "points": {"Lazio": 72},
        "why": "Wikipedia shows an unsourced -1 for Lazio; Lazio finished on 72, level with Inter, and "
               "missed the top four on head-to-head (e.g. https://www.si.com/soccer/2018/05/20/"
               "lazio-2-3-inter-stunning-inter-comeback-breaks-lazio-hearts-seals-champions-league-qualification)",
    },
    ("serie_a", "2018-19"): {
        "points": {"Lazio": 59},
        "why": "Wikipedia shows an unsourced -2 for Lazio; the final table lists Lazio on 59 while showing "
               "Chievo's -3 (https://www.economiaesport.it/2019/05/26/serie-a-classifica-finale-stagione-2018-2019/)",
    },
    ("serie_a", "2022-23"): {
        "order": ("Hellas Verona", "Spezia"),
        "why": "Wikipedia lists the order before the relegation play-off; Verona won it 3-1 and are 17th "
               "(https://it.wikipedia.org/wiki/Serie_A_2022-2023)",
    },
}

WIKI = "https://en.wikipedia.org/w/index.php"
HEADERS = {"User-Agent": "TableTalk/0.1 (football forecasting portfolio project)"}
COLUMNS = ["team", "won", "drawn", "lost", "goals_for", "goals_against", "points"]


def raw_page(title: str) -> str:
    """Wikitext of a page, following one redirect."""
    text = requests.get(WIKI, params={"title": title, "action": "raw"}, headers=HEADERS, timeout=30).text
    redirect = re.match(r"#REDIRECT\s*\[\[:?([^\]]+)\]\]", text, flags=re.I)
    if redirect:
        text = requests.get(WIKI, params={"title": redirect.group(1), "action": "raw"}, headers=HEADERS, timeout=30).text
    return text


def table_block(title: str) -> str | None:
    """The Sports-table block of a season article, or of the template it includes."""
    text = raw_page(title)
    start = text.lower().find("{{#invoke:sports table")
    if start < 0:
        included = re.search(r"\{\{\s*([^{}|\n]*\btable)\s*\}\}", text)
        if not included:
            return None
        text = raw_page("Template:" + included.group(1))
        start = text.lower().find("{{#invoke:sports table")
        if start < 0:
            return None
    end = text.find("</onlyinclude>", start)
    block = text[start:end if end > 0 else start + 20000]
    block = re.sub(r"<!--.*?-->", "", block, flags=re.S)
    return re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", block, flags=re.S)


def parse_table(block: str, normalise) -> list[dict]:
    order = re.search(r"\|\s*team_order\s*=\s*([^|}]+)", block)
    if order:
        codes = [code.strip() for code in order.group(1).replace("\n", " ").split(",") if code.strip()]
    else:
        numbered = {int(n): code.strip() for n, code in re.findall(r"\|\s*team(\d+)\s*=\s*([^|\n}]+)", block)}
        codes = [numbered[n] for n in sorted(numbered)]

    rows = []
    for position, code in enumerate(codes, start=1):
        def field(name: str, default: str = "0") -> str:
            found = re.search(rf"\|\s*{name}_{re.escape(code)}\s*=\s*([^|\n}}]*)", block)
            return found.group(1).strip() if found and found.group(1).strip() else default

        name = field("name", code)
        links = re.findall(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", name)
        candidates = [part for pair in links for part in pair if part] or [name.lstrip("[").strip()]
        team = normalise(candidates)
        won, drawn, lost, goals_for, goals_against = (int(field(key)) for key in ("win", "draw", "loss", "gf", "ga"))
        adjustment = int(field("adjust_points"))
        rows.append({
            "position": position, "team": team or f"UNMAPPED {candidates}",
            "won": won, "drawn": drawn, "lost": lost, "goals_for": goals_for, "goals_against": goals_against,
            "points": 3 * won + drawn + adjustment, "points_adjustment": adjustment,
        })
    return rows


def main(competition: str, pattern: str) -> int:
    warnings.simplefilter("ignore")
    config = load_competition(competition)
    normaliser = default_normaliser()

    def normalise(candidates: list[str]) -> str | None:
        for candidate in candidates:
            try:
                return normaliser.normalise(candidate)
            except Exception:  # noqa: BLE001 - try the next spelling
                continue
        return None

    seasons = [s for s in config.seasons if s != config.current_season]
    frames = []
    for season in seasons:
        start, end = season.split("-")
        title = pattern.format(season=f"{start}–{end}")
        block = table_block(title)
        if block is None:
            print(f"{season}: no table found on {title!r}; fixture NOT written")
            return 1
        table = pd.DataFrame(parse_table(block, normalise)).assign(season=season)
        correction = CORRECTIONS.get((competition, season))
        if correction:
            for team, points in correction.get("points", {}).items():
                row = table["team"] == team
                table.loc[row, "points_adjustment"] += points - table.loc[row, "points"]
                table.loc[row, "points"] = points
            if "order" in correction:
                upper, lower = (table.index[table["team"] == team][0] for team in correction["order"])
                if upper > lower:  # put the first-named club above the second
                    table.loc[[upper, lower], "position"] = table.loc[[lower, upper], "position"].to_numpy()
            print(f"{season}: corrected Wikipedia: {correction['why']}")
        frames.append(table)
    official = pd.concat(frames, ignore_index=True)[["season", "position", *COLUMNS[:-1], "points", "points_adjustment"]]

    matches = load_matches(config, save=False)
    differing = 0
    for season, table in official.groupby("season"):
        ours = league_table(matches, config, season)[COLUMNS].itertuples(index=False, name=None)
        theirs = table.sort_values("position")[COLUMNS].itertuples(index=False, name=None)
        mismatches = [(a, b) for a, b in zip(ours, theirs) if a != b]
        adjusted = table.loc[table["points_adjustment"] != 0, ["team", "points_adjustment"]].values.tolist()
        print(f"{season}: {'identical' if not mismatches else 'DIFFERENT'}" + (f"  adjustments {adjusted}" if adjusted else ""))
        for ours_row, official_row in mismatches:
            print(f"    rebuilt  {ours_row}\n    official {official_row}")
        differing += bool(mismatches)

    path = ROOT / "tests" / "data" / f"{competition}_official_tables.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    official.to_csv(path, index=False)
    print(f"{differing} of {official['season'].nunique()} seasons differ; wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
