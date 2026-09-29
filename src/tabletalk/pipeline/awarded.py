"""Awarded matches seen in the live data: keep going, keep the model honest.

A match is "awarded" when the league decides the result off the pitch (a
forfeit, an ineligible player, an abandoned match). football-data.org marks it
with status AWARDED but gives no reason, date or source, and does not say
whether its score is the one played or the one awarded.

Rule (agreed 2026-09-29):

1. The run keeps going; an awarded match never stops it.
2. The match model never fits on a score that came from an AWARDED record: if
   football-data.co.uk has the score played on the pitch, the model uses that;
   otherwise the match is left out of the fit. One match fewer changes the
   ratings very little; a 3-0 decided in a committee room would mislead them.
3. If ``configs/awarded_results.yaml`` has an entry for the match, the table
   uses it (as for every past season).
4. If not, the table uses football-data.org's result *provisionally*, the
   league's snapshot is marked provisional, and the run report contains a
   ready-to-paste draft entry. A person checks the league's decision, fills in
   the reason, date and source, and adds the entry to the file.

The draft is written to the run report only, never into configs/: every entry
in that file has an official source a person has checked.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from ..config import CompetitionConfig
from ..data.awarded import PLACEHOLDER, load_awarded_results

AWARDED = "AWARDED"


@dataclass(frozen=True)
class AwardedMatch:
    season: str
    date: pd.Timestamp
    home_team: str
    away_team: str
    reported_score: tuple[int, int]            # football-data.org's score
    played_score: tuple[int, int] | None       # football-data.co.uk's, if it has the match
    confirmed: bool                            # an entry exists in awarded_results.yaml

    def describe(self) -> str:
        played = (
            f"played {self.played_score[0]}-{self.played_score[1]} per football-data.co.uk"
            if self.played_score else "no played score in football-data.co.uk"
        )
        state = "confirmed in awarded_results.yaml" if self.confirmed else "NOT YET CONFIRMED"
        return (
            f"{self.season} {self.home_team} v {self.away_team} ({self.date:%Y-%m-%d}): "
            f"football-data.org says AWARDED {self.reported_score[0]}-{self.reported_score[1]}; "
            f"{played}; {state}"
        )


@dataclass
class AwardedReview:
    """What to fit the model on, what to build the table from, and what to tell a person."""

    table_matches: pd.DataFrame
    model_matches: pd.DataFrame
    matches: list[AwardedMatch] = field(default_factory=list)

    @property
    def unconfirmed(self) -> list[AwardedMatch]:
        return [match for match in self.matches if not match.confirmed]

    @property
    def provisional(self) -> bool:
        return bool(self.unconfirmed)

    def draft_entries(self, competition: str) -> str:
        """YAML to paste into configs/awarded_results.yaml, once checked."""
        return "\n".join(_draft_entry(competition, match) for match in self.unconfirmed)


def review_awarded(
    config: CompetitionConfig,
    matches: pd.DataFrame,
    api_matches: pd.DataFrame,
    *,
    recorded: pd.DataFrame | None = None,
) -> AwardedReview:
    """Apply the rule above.

    Args:
        matches: the reconciled dataset (``load_matches``). Played rows from
            football-data.co.uk carry ``source == "football_data_uk"``.
        api_matches: football-data.org's own rows (with ``status``).
        recorded: the awarded-results file (default: configs/awarded_results.yaml).
    """
    recorded = load_awarded_results() if recorded is None else recorded
    recorded = recorded.loc[recorded["competition"] == config.id]
    if "status" not in api_matches.columns:
        return AwardedReview(matches, matches)
    flagged = api_matches.loc[
        (api_matches["status"] == AWARDED).fillna(False).astype(bool)
        & api_matches["played"].fillna(False).astype(bool)
    ]
    if flagged.empty:
        return AwardedReview(matches, matches)

    table_matches = matches.copy()
    leave_out = pd.Series(False, index=matches.index)
    source = matches["source"] if "source" in matches.columns else pd.Series(pd.NA, index=matches.index)
    uk_rows = (source == "football_data_uk").fillna(False).astype(bool)
    found: list[AwardedMatch] = []
    for row in flagged.itertuples(index=False):
        same = (
            (matches["season"].astype(str) == str(row.season))
            & (matches["home_team"] == row.home_team)
            & (matches["away_team"] == row.away_team)
            & matches["played"].fillna(False).astype(bool)
        )
        from_uk = same & uk_rows
        played_score = None
        if bool(from_uk.any()):
            first = matches.loc[from_uk].iloc[0]
            played_score = (int(first["home_goals"]), int(first["away_goals"]))
        # The model never fits on a score taken from the AWARDED record.
        leave_out |= same & ~from_uk
        confirmed = bool(
            (
                (recorded["season"] == str(row.season))
                & (recorded["home_team"] == row.home_team)
                & (recorded["away_team"] == row.away_team)
            ).any()
        )
        reported = (int(row.home_goals), int(row.away_goals))
        if not confirmed:
            # Provisional: the table counts the result the API reports.
            table_matches.loc[same, ["home_goals", "away_goals"]] = list(reported)
        found.append(
            AwardedMatch(
                season=str(row.season), date=pd.Timestamp(row.date), home_team=row.home_team,
                away_team=row.away_team, reported_score=reported, played_score=played_score,
                confirmed=confirmed,
            )
        )
    model_matches = matches.loc[~leave_out].reset_index(drop=True)
    return AwardedReview(table_matches, model_matches, found)


def _draft_entry(competition: str, match: AwardedMatch) -> str:
    played = (
        f"played {match.played_score[0]}-{match.played_score[1]} on {match.date:%d %B %Y}"
        if match.played_score else f"scheduled for {match.date:%d %B %Y}"
    )
    return f"""  - competition: {competition}
    season: "{match.season}"
    home_team: {match.home_team}
    away_team: {match.away_team}
    # As football-data.org reports it: check against the league's decision.
    home_goals: {match.reported_score[0]}
    away_goals: {match.reported_score[1]}
    # For a forfeit counted as a win without goals, add e.g. `result: away_win`.
    date_applied: "{PLACEHOLDER}: date of the league's decision, YYYY-MM-DD"
    reason: >-
      {PLACEHOLDER}: what happened ({played}), who decided, any appeal.
    source: "{PLACEHOLDER}: link to the official decision or a reliable report"
"""
