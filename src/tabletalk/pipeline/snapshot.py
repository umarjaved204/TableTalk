"""Building one league's snapshot: the file the website reads.

The shape is fixed by the data contract, ``contracts/snapshot.schema.json``
(explained in ``contracts/README.md``). Every snapshot is validated against it
before it is written, so a change here that breaks the contract fails the run
instead of breaking the website.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

from ..config import CompetitionConfig
from ..data.awarded import AWARDED_RESULTS_FILE
from ..data.deductions import DEDUCTIONS_FILE
from ..data.playoffs import PLAYOFF_RESULTS_FILE
from ..paths import PROJECT_ROOT, TEAM_ALIASES_FILE

CONTRACT_VERSION = "1.1.0"
CONTRACTS_DIR = PROJECT_ROOT / "contracts"
N_SCORELINES = 5
DECIMALS = 6

SEED_RULE = "first 4 bytes of sha256('<run date, UTC, YYYY-MM-DD>|<competition id>'), big-endian"


def run_seed(run_date: str, competition: str) -> int:
    """The random seed for one league on one day.

    Derived from the date and the competition, so re-running the same day's
    update on the same data gives exactly the same numbers, while different
    days and leagues get unrelated random streams.
    """
    digest = hashlib.sha256(f"{run_date}|{competition}".encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big")


def config_files(config: CompetitionConfig) -> list[Path]:
    """Every file whose contents can change a snapshot."""
    return [
        Path(config.source_path),
        TEAM_ALIASES_FILE,
        DEDUCTIONS_FILE,
        AWARDED_RESULTS_FILE,
        PLAYOFF_RESULTS_FILE,
    ]


def config_hash(paths: list[Path]) -> str:
    """sha256 over the config files, in order.

    Line endings are normalised first: the same config checked out on Windows
    (CRLF) and on a Linux runner (LF) must hash the same.
    """
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.name.encode("utf-8") + b"\0")
        digest.update(path.read_bytes().replace(b"\r\n", b"\n") if path.exists() else b"<missing>")
        digest.update(b"\0")
    return "sha256:" + digest.hexdigest()


@lru_cache(maxsize=1)
def code_version() -> tuple[str | None, bool | None]:
    """(git commit, whether tracked files have uncommitted changes).

    ``(None, None)`` when git is not available, e.g. an installed copy.
    """
    try:
        commit = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=PROJECT_ROOT, capture_output=True, text=True, check=True
        ).stdout.strip()
        dirty = subprocess.run(
            ["git", "status", "--porcelain", "--untracked-files=no"],
            cwd=PROJECT_ROOT, capture_output=True, text=True, check=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None, None
    return commit, bool(dirty)


@dataclass
class LeagueRun:
    """Everything one league's run produced, before it is written."""

    config: CompetitionConfig
    season: str
    table: pd.DataFrame
    summary: pd.DataFrame
    positions: pd.DataFrame
    predictions: pd.DataFrame
    model: object
    seed: int
    n_simulations: int
    promoted_strategy: str
    promoted_teams: list[str]
    uncertainty: str
    latest_result: pd.Series | None
    provisional: bool
    notices: list[str]
    fixtures: pd.DataFrame | None = None


def build_snapshot(run: LeagueRun, *, generated_at: pd.Timestamp) -> dict:
    config = run.config
    rules = config.for_season(run.season)
    commit, dirty = code_version()
    files = config_files(config)
    latest = run.latest_result
    return {
        "contract_version": CONTRACT_VERSION,
        "competition": {"id": config.id, "name": config.name, "country": config.country, "season": run.season},
        "generated_at": _utc(generated_at),
        "data_through": None if latest is None else _date(latest["date"]),
        "latest_result": None if latest is None else {
            "date": _date(latest["date"]),
            "home_team": str(latest["home_team"]),
            "away_team": str(latest["away_team"]),
            "home_goals": int(latest["home_goals"]),
            "away_goals": int(latest["away_goals"]),
        },
        "provisional": bool(run.provisional),
        "notices": list(run.notices),
        "run": {
            "seed": int(run.seed),
            "seed_rule": SEED_RULE,
            "n_simulations": int(run.n_simulations),
            "code_commit": commit,
            "code_dirty": dirty,
            "config_hash": config_hash(files),
            "config_files": [str(path.relative_to(PROJECT_ROOT)).replace("\\", "/") for path in files],
            "model": {
                # The model's as_of is exclusive ("results before this date").
                "fitted_through": None if run.model.as_of is None else _date(run.model.as_of - pd.Timedelta(days=1)),
                "promoted_strategy": run.promoted_strategy,
                "promoted_teams": sorted(run.promoted_teams),
                "strength_uncertainty": run.uncertainty,
                "match_predictions": "best-estimate ratings (the season simulations also draw rating uncertainty)",
            },
        },
        "sources": [
            {"loader": source.loader, "role": source.role, "params": _jsonable(dict(source.params))}
            for source in config.data_sources
        ],
        "zones": [
            {"id": zone.id, "label": zone.label, "positions": [int(p) for p in zone.positions]}
            for zone in rules.zones
        ],
        "table": [
            {column: (str(value) if column == "team" else int(value)) for column, value in row.items()}
            for row in run.table.to_dict(orient="records")
        ],
        "teams": [_team_entry(team, row, run.positions.loc[team], rules) for team, row in run.summary.iterrows()],
        "upcoming_matches": [_match_entry(row, run.model) for _, row in run.predictions.iterrows()],
    }


def _team_entry(team: str, row: pd.Series, positions: pd.Series, rules: CompetitionConfig) -> dict:
    return {
        "team": str(team),
        "position_now": int(row["position_now"]),
        "points_now": int(row["points_now"]),
        "expected_points": _round(row["expected_points"]),
        "points_p10": _round(row["points_p10"]),
        "points_p90": _round(row["points_p90"]),
        "expected_position": _round(row["expected_position"]),
        "zones": {zone.id: _round(row[zone.id]) for zone in rules.zones},
        "finishing_positions": [_round(p) for p in positions.to_numpy()],
    }


def _match_entry(row: pd.Series, model) -> dict:
    matrix = model.score_matrix(row["home_team"], row["away_team"], neutral=bool(row.get("neutral", False)))
    flat = np.argsort(matrix, axis=None)[::-1][:N_SCORELINES]
    scorelines = [
        {"home": int(h), "away": int(a), "probability": _round(matrix[h, a])}
        for h, a in zip(*np.unravel_index(flat, matrix.shape))
    ]
    kickoff = row.get("kickoff_utc")
    return {
        "match_id": _optional_str(row.get("source_id")),
        "matchday": _optional_str(row.get("matchday")),
        "date": None if pd.isna(row["date"]) else _date(row["date"]),
        "kickoff_utc": None if kickoff is None or pd.isna(kickoff) else _utc(kickoff),
        "status": _optional_str(row.get("status")),
        "home_team": str(row["home_team"]),
        "away_team": str(row["away_team"]),
        "probabilities": {"home": _round(row["p_home"]), "draw": _round(row["p_draw"]), "away": _round(row["p_away"])},
        "expected_goals": {"home": _round(row["expected_home_goals"]), "away": _round(row["expected_away_goals"])},
        "likely_scorelines": scorelines,
    }


def validate(document: dict, schema_name: str = "snapshot.schema.json") -> list[str]:
    """Contract problems in plain English (empty = valid)."""
    import jsonschema

    schema = json.loads((CONTRACTS_DIR / schema_name).read_text(encoding="utf-8"))
    validator = jsonschema.Draft202012Validator(schema)
    return [
        f"{'/'.join(str(p) for p in error.absolute_path) or '(top level)'}: {error.message}"
        for error in sorted(validator.iter_errors(document), key=lambda e: list(e.absolute_path))
    ][:20]


def _round(value) -> float:
    return round(float(value), DECIMALS)


def _date(value) -> str:
    return pd.Timestamp(value).strftime("%Y-%m-%d")


def _utc(value) -> str:
    stamp = pd.Timestamp(value)
    stamp = stamp.tz_localize("UTC") if stamp.tzinfo is None else stamp.tz_convert("UTC")
    return stamp.strftime("%Y-%m-%dT%H:%M:%SZ")


def _optional_str(value) -> str | None:
    return None if value is None or (not isinstance(value, str) and pd.isna(value)) else str(value)


def _jsonable(value):
    """Config params as plain JSON (they are YAML scalars, lists and dicts)."""
    return json.loads(json.dumps(value, default=str))
