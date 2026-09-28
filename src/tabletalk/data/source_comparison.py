"""Comparing fixture sources for the current season.

Which source should be primary for the schedule (openfootball or
football-data.org) is decided by the rule in
``reports/protocols/step1-fixture-source.md``, written before any comparison
was run. This module measures the criteria it names:

C1  the source's schedule alone passes ``check_fixture_list``;
C2  dates of played matches agree with football-data.co.uk, an independent
    third source that records when each match was actually played;
C3  upcoming matches with a confirmed kick-off time given in UTC by the source
    itself (no timezone assumption);
C4  whether the source marks postponements explicitly.

It also lists upcoming matches where the two sources give different UTC
kick-offs, to be checked again once those matches have been played.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from ..config import CompetitionConfig
from .fixtures import check_fixture_list, season_rows
from .reconcile import meeting_key

#: A status meaning "the kick-off time is confirmed" (football-data.org's TIMED).
CONFIRMED_STATUSES = frozenset({"TIMED"})
POSTPONED_STATUSES = frozenset({"POSTPONED"})


@dataclass
class SourceScore:
    """How one fixture source does on the protocol's criteria, for one league."""

    source: str
    matches: int
    c1_problems: list[str]
    c2_compared: int
    c2_mismatches: pd.DataFrame
    c3_upcoming: int
    c3_confirmed_utc: int
    c4_explicit_postponements: bool
    postponed_now: int
    notes: list[str] = field(default_factory=list)

    @property
    def c1_pass(self) -> bool:
        return not self.c1_problems


def score_source(
    name: str,
    schedule: pd.DataFrame,
    reference_results: pd.DataFrame,
    config: CompetitionConfig,
    season: str,
    *,
    kickoffs_in_utc: bool,
) -> SourceScore:
    """Measure C1-C4 for one source's full-season schedule (already normalised)."""
    rows = season_rows(schedule, season)
    played_reference = season_rows(reference_results, season)
    played_reference = played_reference.loc[played_reference["played"].fillna(False).astype(bool)]

    # C2: the candidate's date for every match the reference says was played.
    candidate = rows.assign(_key=meeting_key(rows))[["_key", "home_team", "away_team", "date"]]
    reference = played_reference.assign(_key=meeting_key(played_reference))[["_key", "date"]]
    joined = reference.merge(candidate, on="_key", how="left", suffixes=("_played", "_listed"))
    differs = joined["date_listed"].isna() | (
        joined["date_listed"].dt.normalize() != joined["date_played"].dt.normalize()
    )
    mismatches = joined.loc[differs, ["home_team", "away_team", "date_played", "date_listed"]]

    upcoming = rows.loc[~rows["played"].fillna(False).astype(bool)]
    status = upcoming["status"] if "status" in upcoming.columns else pd.Series(pd.NA, index=upcoming.index)
    confirmed_utc = 0
    if kickoffs_in_utc and "kickoff_utc" in upcoming.columns:
        confirmed_utc = int((upcoming["kickoff_utc"].notna() & status.isin(CONFIRMED_STATUSES)).sum())

    return SourceScore(
        source=name,
        matches=len(rows),
        c1_problems=check_fixture_list(schedule, config, season),
        c2_compared=len(joined),
        c2_mismatches=mismatches.reset_index(drop=True),
        c3_upcoming=len(upcoming),
        c3_confirmed_utc=confirmed_utc,
        c4_explicit_postponements="status" in rows.columns,
        postponed_now=int(status.isin(POSTPONED_STATUSES).sum()),
    )


def kickoff_disagreements(a: pd.DataFrame, b: pd.DataFrame, season: str) -> pd.DataFrame:
    """Upcoming matches both sources list, where their UTC kick-offs differ.

    Not scored: which source is right is only known once the match is played.
    """
    frames = []
    for frame in (a, b):
        rows = season_rows(frame, season)
        rows = rows.loc[~rows["played"].fillna(False).astype(bool)]
        if "kickoff_utc" not in rows.columns:
            return pd.DataFrame(columns=["home_team", "away_team", "kickoff_a", "kickoff_b"])
        frames.append(rows.assign(_key=meeting_key(rows)))
    joined = frames[0][["_key", "home_team", "away_team", "kickoff_utc"]].merge(
        frames[1][["_key", "kickoff_utc"]], on="_key", suffixes=("_a", "_b")
    )
    differs = joined["kickoff_utc_a"] != joined["kickoff_utc_b"]
    differs &= ~(joined["kickoff_utc_a"].isna() & joined["kickoff_utc_b"].isna())
    return (
        joined.loc[differs, ["home_team", "away_team", "kickoff_utc_a", "kickoff_utc_b"]]
        .rename(columns={"kickoff_utc_a": "kickoff_a", "kickoff_utc_b": "kickoff_b"})
        .sort_values("kickoff_a")
        .reset_index(drop=True)
    )


def decide(scores: dict[str, tuple[SourceScore, SourceScore]]) -> tuple[str, list[str]]:
    """Apply the protocol's rule to every league's ``(openfootball, football-data.org)``.

    Returns the primary source's name and the reasons, one line per league.
    """
    reasons, all_pass = [], True
    for league, (openfootball, fdorg) in scores.items():
        conditions = {
            "C1 complete": fdorg.c1_pass,
            "C2 dates no worse": len(fdorg.c2_mismatches) <= len(openfootball.c2_mismatches),
            "C3 UTC kick-offs no fewer": fdorg.c3_confirmed_utc >= openfootball.c3_confirmed_utc,
        }
        failed = [name for name, ok in conditions.items() if not ok]
        all_pass &= not failed
        reasons.append(
            f"{league}: " + ("all three conditions met" if not failed else f"fails {', '.join(failed)}")
        )
    return ("football_data_org" if all_pass and scores else "openfootball"), reasons
