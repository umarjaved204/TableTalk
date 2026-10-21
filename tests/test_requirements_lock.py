"""The locked library versions the nightly run installs (requirements-lock.txt).

The libraries are listed twice: in pyproject.toml (what `pip install -e .`
needs) and in requirements-lock.in (the input pip-tools compiles, named so that
Dependabot recognises the lock). These tests keep the two lists the same and
the lock complete. Offline.
"""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _requirement_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip() and not line.lstrip().startswith("#")]


def _name(requirement: str) -> str:
    return re.split(r"[<>=!~;\[ ]", requirement, maxsplit=1)[0].lower().replace("_", "-")


def test_the_lock_input_lists_exactly_the_projects_dependencies():
    project = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))["project"]["dependencies"]
    lock_in = _requirement_lines((ROOT / "requirements-lock.in").read_text(encoding="utf-8"))
    assert sorted(lock_in) == sorted(project)


def test_every_locked_library_has_one_exact_version_and_hashes():
    text = (ROOT / "requirements-lock.txt").read_text(encoding="utf-8")
    entries = re.findall(r"^([A-Za-z0-9_.-]+)==(\S+) \\\n((?:\s+--hash=sha256:[0-9a-f]{64}(?: \\)?\n)+)", text, re.M)
    names = [_name(name) for name, _version, _hashes in entries]
    assert len(names) == len(set(names))
    # Every requirement line in the file is one of these entries (none without hashes).
    assert len(entries) == len(re.findall(r"^[A-Za-z0-9_.-]+==", text, re.M))
    lock_in = {_name(line) for line in _requirement_lines((ROOT / "requirements-lock.in").read_text(encoding="utf-8"))}
    assert lock_in <= set(names)


def test_the_lock_records_the_command_dependabot_replays():
    header = (ROOT / "requirements-lock.txt").read_text(encoding="utf-8").split("\n\n", 1)[0]
    assert "--output-file=requirements-lock.txt" in header and "requirements-lock.in" in header
    assert "--generate-hashes" in header
    assert "--no-index" not in header  # would stop Dependabot reaching PyPI
