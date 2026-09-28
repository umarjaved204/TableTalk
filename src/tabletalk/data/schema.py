"""The one match schema every data source must produce.

Keeping a single, strictly validated shape is what lets us add sources
(football-data.co.uk CSVs now, a European-results source in Phase 3) without
touching the model or the simulators.

Columns
-------
date         datetime64[ns]  kick-off date (no time); may be null for an unplayed fixture
competition  string          competition id, matching a config file stem
season       string          canonical season label, e.g. "2025-26"
home_team    string          canonical team name (see tabletalk.data.normalise)
away_team    string          canonical team name
home_goals   Int64           full-time goals; null for unplayed fixtures
away_goals   Int64           full-time goals; null for unplayed fixtures
neutral      boolean         True when neither team is at home (cup finals)
played       boolean         True when the result is known

Unplayed fixtures live in the same frame as results: the model fits on
``played`` rows and the simulator fills in the rest.
"""

from __future__ import annotations

import pandas as pd

#: Required columns, in canonical order.
MATCH_COLUMNS: tuple[str, ...] = (
    "date",
    "competition",
    "season",
    "home_team",
    "away_team",
    "home_goals",
    "away_goals",
    "neutral",
    "played",
)

#: Columns a source may add. Carried through if present, never required.
#: ``matchday`` is the round the fixture list puts a match in; ``stage`` matters
#: from Phase 3 on (league phase / quarter-final / final). A live-season source
#: may add ``kickoff_utc`` (tz-aware UTC timestamp), ``status`` (the source's
#: own match status, e.g. POSTPONED) and ``source_id`` (the source's match id,
#: stable when a match is rescheduled).
OPTIONAL_COLUMNS: tuple[str, ...] = (
    "matchday", "stage", "source", "kickoff_utc", "status", "source_id"
)

_DTYPES: dict[str, str] = {
    "competition": "string",
    "season": "string",
    "home_team": "string",
    "away_team": "string",
    "home_goals": "Int64",
    "away_goals": "Int64",
    "neutral": "boolean",
    "played": "boolean",
}


class SchemaError(ValueError):
    """Raised when a loader produces something that is not a valid match frame."""


def empty_match_frame() -> pd.DataFrame:
    """An empty frame with the right columns and dtypes (useful as a base case)."""
    frame = pd.DataFrame({column: pd.Series(dtype="object") for column in MATCH_COLUMNS})
    frame["date"] = pd.Series(dtype="datetime64[ns]")
    return frame.astype(_DTYPES)


def validate_matches(frame: pd.DataFrame, *, source: str = "match frame") -> pd.DataFrame:
    """Coerce ``frame`` to the standard schema and check it for consistency.

    Returns a new, sorted frame. Raises SchemaError with a message naming
    ``source`` when something is wrong, because a silently mangled column here
    would produce plausible-looking but wrong probabilities later.
    """
    missing = [column for column in MATCH_COLUMNS if column not in frame.columns]
    if missing:
        raise SchemaError(f"{source}: missing column(s) {missing}")

    extra = [column for column in frame.columns if column in OPTIONAL_COLUMNS]
    out = frame.loc[:, [*MATCH_COLUMNS, *extra]].copy()

    out["date"] = pd.to_datetime(out["date"], errors="coerce")
    for column, dtype in _DTYPES.items():
        out[column] = out[column].astype(dtype)

    # --- required values present -------------------------------------------
    for column in ("competition", "season", "home_team", "away_team", "neutral", "played"):
        n_null = int(out[column].isna().sum())
        if n_null:
            raise SchemaError(f"{source}: {n_null} row(s) have a missing {column}")

    # A played match must be dated. An unplayed one may not be: fixtures derived
    # from a round-robin schedule are known pairings without a known date, and
    # nothing in the model or simulator needs a future date.
    undated_result = out["played"].fillna(False).astype(bool) & out["date"].isna()
    if int(undated_result.sum()):
        raise SchemaError(f"{source}: {int(undated_result.sum())} played match(es) have no valid date")

    # --- a played match must have a score, an unplayed one must not --------
    played = out["played"].fillna(False).astype(bool)
    scored = out["home_goals"].notna() & out["away_goals"].notna()
    if int((played & ~scored).sum()):
        bad = out.loc[played & ~scored].head(3)
        raise SchemaError(
            f"{source}: {int((played & ~scored).sum())} played match(es) without a "
            f"full-time score, e.g.\n{bad.to_string(index=False)}"
        )
    if int((~played & scored).sum()):
        raise SchemaError(
            f"{source}: {int((~played & scored).sum())} unplayed fixture(s) carry a score"
        )

    # --- sanity checks that catch column mix-ups --------------------------
    negative = (out["home_goals"].fillna(0) < 0) | (out["away_goals"].fillna(0) < 0)
    if int(negative.sum()):
        raise SchemaError(f"{source}: {int(negative.sum())} row(s) have negative goals")

    self_match = out["home_team"] == out["away_team"]
    if int(self_match.sum()):
        teams = sorted(set(out.loc[self_match, "home_team"]))
        raise SchemaError(f"{source}: team(s) playing themselves: {teams}")

    # Same fixture on the same date twice means a file was loaded twice, or two
    # sources overlap. We deliberately do NOT key on the pair alone: leagues
    # with four meetings per pair, and cups where two clubs meet in a group and
    # again in a knockout round, legitimately repeat a home/away pairing.
    duplicated = out.duplicated(subset=["competition", "season", "date", "home_team", "away_team"])
    if int(duplicated.sum()):
        examples = out.loc[duplicated, ["season", "date", "home_team", "away_team"]].head(5)
        raise SchemaError(
            f"{source}: {int(duplicated.sum())} duplicate fixture(s) "
            f"(same season, date and home/away pair):\n{examples.to_string(index=False)}"
        )

    out = out.sort_values(["date", "home_team", "away_team"], kind="stable")
    return out.reset_index(drop=True)
