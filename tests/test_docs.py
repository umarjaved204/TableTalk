"""The documentation's links: every relative link points at a file that exists,
and every `#section` link at a heading that exists (GitHub's anchor rules).

The README is a short front page and the detail lives in docs/, so most links
cross between files; a moved or renamed section would otherwise break them
silently. Offline.
"""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import unquote

import pytest

ROOT = Path(__file__).resolve().parents[1]
DOCS = [ROOT / "README.md", *sorted((ROOT / "docs").glob("*.md")), ROOT / "contracts" / "README.md"]

LINK = re.compile(r"\]\(([^)\s]+)\)|(?:src|srcset|href)=\"([^\"]+)\"")


def _without_code(text: str) -> str:
    """The text with fenced code blocks and inline code removed (links there are not links)."""
    text = re.sub(r"^```.*?^```", "", text, flags=re.S | re.M)
    return re.sub(r"`[^`\n]*`", "", text)


def _anchors(path: Path) -> set[str]:
    """GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens, -1, -2 for repeats."""
    text = re.sub(r"^```.*?^```", "", path.read_text(encoding="utf-8"), flags=re.S | re.M)
    seen: dict[str, int] = {}
    out = set()
    for heading in re.findall(r"^#{1,6} (.+?)\s*$", text, flags=re.M):
        base = re.sub(r"[^\w\- ]", "", heading.strip().lower()).replace(" ", "-")
        count = seen.get(base, 0)
        out.add(base if count == 0 else f"{base}-{count}")
        seen[base] = count + 1
    return out


def _links(path: Path) -> list[str]:
    return [a or b for a, b in LINK.findall(_without_code(path.read_text(encoding="utf-8")))]


@pytest.mark.parametrize("doc", DOCS, ids=lambda p: p.relative_to(ROOT).as_posix())
def test_every_relative_link_and_section_link_resolves(doc):
    broken = []
    for link in _links(doc):
        if re.match(r"^(https?:|mailto:)", link):
            continue
        target, _, anchor = link.partition("#")
        path = (doc.parent / unquote(target)).resolve() if target else doc
        if not path.exists():
            broken.append(f"{link}: no such file")
        elif anchor and path.suffix == ".md" and anchor not in _anchors(path):
            broken.append(f"{link}: no heading with that anchor")
    assert not broken, "\n".join(broken)


def test_the_readme_stays_a_short_front_page():
    lines = (ROOT / "README.md").read_text(encoding="utf-8").splitlines()
    assert len(lines) <= 250, f"README.md has {len(lines)} lines: move detail into docs/"


def test_the_website_reads_the_five_leagues_table_from_the_readme():
    """web/tests/unit/backtests.test.ts finds this heading and table in README.md."""
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    assert "\n## Phase 2: the five leagues side by side\n" in readme
    assert "\n| | Premier League | Bundesliga | La Liga | Serie A | Ligue 1 |\n" in readme
