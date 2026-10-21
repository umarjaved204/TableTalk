"""Checking the raw-download cache before the nightly run trusts it.

The nightly run keeps past seasons' downloads (``data/raw/``) in a GitHub
Actions cache, so it does not fetch ~180 files every night. Anything that can
write to that cache could change an old result, and the model would quietly fit
on it. So the run keeps a record of every past-season file, as first
downloaded: ``state/raw_manifest.sha256`` on the ``data`` branch (one
``<sha256>  <path under data/raw>`` line each, sorted). The ``data`` branch is
protected and its publish job refuses any change to an existing line, so the
record cannot be rewritten through the cache.

Before the update (:func:`prepare`): every cached file that is not in the
record with the same hash is deleted, so the update downloads it again. With no
record yet, the whole cache is deleted: the first record must come from a
fresh download, not from whatever the cache held.

After the update (:func:`record`): past-season files not yet in the record are
added (they were just downloaded, since anything unrecorded was deleted).
Existing lines never change. If a past-season file was downloaded again and
now differs from its record (a source rewrote an old season, or a deleted cache
file was replaced by something different), the record keeps the original and
this is reported as a problem: the run fails so a person can look. The update
itself already used the new download; the record says what it should have been.

Current-season files are left out: the run downloads them again every time.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path

from ..config import available_competitions, load_competition
from ..data.loaders import build_loaders
from ..data.seasons import Season
from ..paths import RAW_DATA_DIR

MANIFEST = Path("state") / "raw_manifest.sha256"


@dataclass
class Prepared:
    kept: int = 0
    deleted: list[str] = field(default_factory=list)
    cold: bool = False  # no record yet: the whole cache was cleared


def current_season_files(raw_dir: Path = RAW_DATA_DIR, competitions: list[str] | None = None) -> set[str]:
    """Paths (relative to ``raw_dir``, ``/``-separated) the run downloads again every time."""
    out = set()
    for competition in competitions or available_competitions():
        config = load_competition(competition)
        current = Season.parse(config.current_season)
        for loader in build_loaders(config):
            path = loader.cache_path(current)
            if current in loader.seasons and path.is_relative_to(raw_dir):
                out.add(_relative(raw_dir, path))
    return out


def read(path: Path) -> dict[str, str]:
    """The record: path -> sha256. Empty if there is none."""
    if not path.exists():
        return {}
    entries = {}
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        digest, _, name = line.partition("  ")
        if len(digest) != 64 or not name:
            raise ValueError(f"{path}: line {number} is not '<sha256>  <path>'")
        entries[name] = digest
    return entries


def prepare(manifest: Path, raw_dir: Path = RAW_DATA_DIR) -> Prepared:
    """Delete every cached file that does not match the record (all of them if there is no record)."""
    out = Prepared()
    if not manifest.exists():
        out.cold = True
        out.deleted = sorted(_relative(raw_dir, path) for path in _files(raw_dir))
        for path in _files(raw_dir):
            path.unlink()
        return out
    recorded = read(manifest)
    for path in _files(raw_dir):
        name = _relative(raw_dir, path)
        if recorded.get(name) == _sha256(path):
            out.kept += 1
        else:
            path.unlink()
            out.deleted.append(name)
    out.deleted.sort()
    return out


def record(manifest: Path, raw_dir: Path = RAW_DATA_DIR, competitions: list[str] | None = None) -> tuple[list[str], list[str]]:
    """Add new past-season files to the record. Returns (added, problems); existing lines never change."""
    recorded = read(manifest)
    current = current_season_files(raw_dir, competitions)
    added, problems = [], []
    for path in _files(raw_dir):
        name = _relative(raw_dir, path)
        if name in current:
            continue
        digest = _sha256(path)
        if name not in recorded:
            recorded[name] = digest
            added.append(name)
        elif recorded[name] != digest:
            problems.append(
                f"{name} was downloaded again and differs from its record ({recorded[name][:12]}... now "
                f"{digest[:12]}...): the source may have changed an old season. The record keeps the original"
            )
    manifest.parent.mkdir(parents=True, exist_ok=True)
    text = "".join(f"{recorded[name]}  {name}\n" for name in sorted(recorded))
    temporary = manifest.with_name(manifest.name + ".tmp")
    temporary.write_text(text, encoding="utf-8", newline="\n")
    temporary.replace(manifest)
    return sorted(added), problems


def _files(raw_dir: Path) -> list[Path]:
    return sorted(path for path in raw_dir.rglob("*") if path.is_file()) if raw_dir.exists() else []


def _relative(raw_dir: Path, path: Path) -> str:
    return path.relative_to(raw_dir).as_posix()


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()
