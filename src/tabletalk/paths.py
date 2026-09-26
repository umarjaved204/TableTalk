"""Filesystem layout.

Every path in TableTalk is derived from the project root, so the package works
the same whether it is run from the repo, installed, or imported in a notebook.
Set ``TABLETALK_HOME`` to relocate the project data/config directories.
"""

from __future__ import annotations

import os
from pathlib import Path

# .../src/tabletalk/paths.py -> .../src/tabletalk -> .../src -> project root
_PACKAGE_DIR = Path(__file__).resolve().parent
_DEFAULT_ROOT = _PACKAGE_DIR.parents[1]

PROJECT_ROOT = Path(os.environ.get("TABLETALK_HOME", _DEFAULT_ROOT)).resolve()

CONFIG_DIR = PROJECT_ROOT / "configs"
COMPETITION_CONFIG_DIR = CONFIG_DIR / "competitions"
TEAM_ALIASES_FILE = CONFIG_DIR / "team_aliases.yaml"

DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"          # untouched source downloads
PROCESSED_DATA_DIR = DATA_DIR / "processed"  # normalised, standard-schema parquet/csv


def ensure_dir(path: Path) -> Path:
    """Create ``path`` (and parents) if needed and return it."""
    path.mkdir(parents=True, exist_ok=True)
    return path
