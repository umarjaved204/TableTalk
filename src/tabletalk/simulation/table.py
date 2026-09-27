"""League tables and tiebreakers.

Everything here is driven by the competition config: the points for a win or a
draw, and the ordered list of tiebreakers. No criterion order is hardcoded; the
Premier League (goal difference first) and La Liga (head-to-head first) are the
same code with different config lists.

How tiebreaking works
---------------------
Teams are ordered by points. Teams level on points form a *group*, and the
config's tiebreakers are applied to that group one at a time:

1. Compute the criterion for every team in the group (e.g. goal difference).
2. Order the group by it. Teams with different values are now separated.
3. Teams still level form smaller groups, which move on to the *next*
   criterion. Repeat until everyone is separated or the criteria run out.

Two kinds of criterion behave differently:

* **Season-wide** criteria (goal difference, goals scored, wins, ...) use all of
  a team's matches, so a team's value does not depend on who else is tied.
* **Head-to-head** criteria use only the matches *among the tied teams*: a
  mini-table. So with a three-way tie, head-to-head points come from the six
  matches among those three teams, not from any two-team comparison.

A run of consecutive head-to-head criteria is applied as one **block**, and
every criterion in the block uses the mini-table of the teams that were level
when the block *started*. If head-to-head points split a four-way tie into
"one team, then three level", head-to-head goal difference for those three is
still computed from the matches among all four. That is how the rules are
normally worded ("in the matches between the teams concerned").

Some competitions (UEFA's, several domestic leagues) add that if the block
leaves a *smaller* group still level, the whole block is **re-applied** to that
group, now using only the matches among *its* teams. That is the config flag
``head_to_head_reapply``. It never matters for a two-team tie.

If the criteria run out with teams still level, they are ordered
alphabetically, so the result is always deterministic.
"""

from __future__ import annotations

from dataclasses import dataclass
from itertools import groupby
from typing import Callable, Mapping, Sequence

import numpy as np
import pandas as pd

from ..config import KNOWN_TIEBREAKERS, CompetitionConfig, PointsSystem
from ..data.awarded import apply_awarded_results
from ..data.deductions import points_adjustments
from ..data.playoffs import recorded_playoff_winner

#: Plays one match and says who won: ``play_match(home, away, neutral)`` returns
#: the winner's name. The simulator builds one from the match model.
PlayMatch = Callable[[str, str, bool], str]

#: Criteria computed from a team's whole season. Higher value ranks higher.
SEASON_CRITERIA: frozenset[str] = frozenset(
    {"goal_difference", "goals_scored", "goals_conceded", "wins", "away_wins", "away_goals_scored"}
)
#: Criteria computed from the matches among the tied teams only.
HEAD_TO_HEAD_CRITERIA: frozenset[str] = frozenset(
    {
        "head_to_head_points",
        "head_to_head_goal_difference",
        "head_to_head_goals_scored",
        "head_to_head_away_goals",
    }
)
#: Criteria that do not depend on results at all.
ORDERING_CRITERIA: frozenset[str] = frozenset({"coin_flip", "playoff_match", "alphabetical"})

assert SEASON_CRITERIA | HEAD_TO_HEAD_CRITERIA | ORDERING_CRITERIA == KNOWN_TIEBREAKERS, (
    "every tiebreaker the config accepts must be implemented here"
)


# ---------------------------------------------------------------------------
# Results as arrays
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SeasonResults:
    """One season's played matches as integer arrays, indexed by team.

    ``teams[i]`` is the name of team ``i``; ``home[k]`` and ``away[k]`` are the
    team indices of match ``k``. Array form keeps the simulator fast: a
    simulated season is just a different set of goal arrays.

    ``outcome`` is almost always None: a result follows from its goals. It is
    set for a match awarded off the pitch where the win counts but the goals do
    not (France's "match perdu par pénalité", recorded 0-0): per match, -1 means
    "from the goals", 0 home win, 1 draw, 2 away win.
    """

    teams: tuple[str, ...]
    home: np.ndarray
    away: np.ndarray
    home_goals: np.ndarray
    away_goals: np.ndarray
    outcome: np.ndarray | None = None

    @classmethod
    def from_matches(cls, matches: pd.DataFrame, teams: Sequence[str] | None = None) -> "SeasonResults":
        played = matches.loc[matches["played"].fillna(False).astype(bool)]
        names = tuple(sorted(teams if teams is not None else set(played["home_team"]) | set(played["away_team"])))
        index = {team: i for i, team in enumerate(names)}
        outcome = None
        if "forced_outcome" in played.columns and played["forced_outcome"].notna().any():
            outcome = played["forced_outcome"].fillna(-1).to_numpy(dtype=int)
        return cls(
            teams=names,
            home=played["home_team"].map(index).to_numpy(dtype=int),
            away=played["away_team"].map(index).to_numpy(dtype=int),
            home_goals=played["home_goals"].to_numpy(dtype=int),
            away_goals=played["away_goals"].to_numpy(dtype=int),
            outcome=outcome,
        )

    def subset(self, keep: np.ndarray) -> "SeasonResults":
        """The same season restricted to the matches where ``keep`` is True."""
        return SeasonResults(
            teams=self.teams,
            home=self.home[keep],
            away=self.away[keep],
            home_goals=self.home_goals[keep],
            away_goals=self.away_goals[keep],
            outcome=None if self.outcome is None else self.outcome[keep],
        )

    @property
    def n_teams(self) -> int:
        return len(self.teams)


def result_points(scored, conceded, points: PointsSystem):
    """Points for the side that scored ``scored`` and conceded ``conceded``."""
    scored = np.asarray(scored)
    conceded = np.asarray(conceded)
    return np.where(scored > conceded, points.win, np.where(scored == conceded, points.draw, points.loss))


def season_totals(results: SeasonResults, points: PointsSystem) -> dict[str, np.ndarray]:
    """Per-team totals over the whole season: the table's columns."""
    n = results.n_teams
    h, a = results.home, results.away
    hg, ag = results.home_goals, results.away_goals

    def per_team(home_values, away_values):
        return np.bincount(h, home_values, n) + np.bincount(a, away_values, n)

    home_win, draw, away_win = (hg > ag), (hg == ag), (hg < ag)
    if results.outcome is not None:
        forced = results.outcome >= 0
        home_win = np.where(forced, results.outcome == 0, home_win)
        draw = np.where(forced, results.outcome == 1, draw)
        away_win = np.where(forced, results.outcome == 2, away_win)
    totals = {
        "played": per_team(np.ones_like(hg), np.ones_like(ag)),
        "wins": per_team(home_win, away_win),
        "draws": per_team(draw, draw),
        "losses": per_team(away_win, home_win),
        "goals_for": per_team(hg, ag),
        "goals_against": per_team(ag, hg),
        "away_goals": np.bincount(a, ag, n),
        "away_wins": np.bincount(a, away_win, n),
        "points": per_team(
            np.where(home_win, points.win, np.where(draw, points.draw, points.loss)),
            np.where(away_win, points.win, np.where(draw, points.draw, points.loss)),
        ),
    }
    totals = {key: value.astype(int) for key, value in totals.items()}
    totals["goal_difference"] = totals["goals_for"] - totals["goals_against"]
    return totals


def _apply_recorded_playoffs(order, results, totals, config, season) -> list[int]:
    """Swap two clubs level on points at a play-off position if the lower one won the play-off."""
    order = list(order)
    for playoff in config.position_playoffs:
        upper, lower = order[playoff.position - 1], order[playoff.position]
        if totals["points"][upper] != totals["points"][lower]:
            continue
        winner = recorded_playoff_winner(config.id, season, results.teams[upper], results.teams[lower])
        if winner == results.teams[lower]:
            order[playoff.position - 1], order[playoff.position] = lower, upper
    return order


def with_points_adjustment(totals: Mapping[str, np.ndarray], adjustment: np.ndarray) -> dict[str, np.ndarray]:
    """``totals`` with ``adjustment`` added to the points column (along the last axis).

    Only the season total changes. Head-to-head criteria are computed from the
    matches between tied teams (see ``_head_to_head_values``), so a deduction
    never leaks into them.
    """
    out = dict(totals)
    out["points"] = totals["points"] + adjustment
    return out


# ---------------------------------------------------------------------------
# The tiebreaker engine
# ---------------------------------------------------------------------------


def _season_criterion(name: str, totals: Mapping[str, np.ndarray]) -> np.ndarray:
    """A season-wide criterion for every team, oriented so higher ranks higher."""
    if name == "goal_difference":
        return totals["goal_difference"]
    if name == "goals_scored":
        return totals["goals_for"]
    if name == "goals_conceded":
        return -totals["goals_against"]  # fewer conceded is better
    if name == "wins":
        return totals["wins"]
    if name == "away_wins":
        return totals["away_wins"]
    if name == "away_goals_scored":
        return totals["away_goals"]
    raise KeyError(name)


def _head_to_head_values(
    name: str, group: Sequence[int], results: SeasonResults, points: PointsSystem
) -> dict[int, float]:
    """A head-to-head criterion for each team, from matches among ``group`` only."""
    members = np.zeros(results.n_teams, dtype=bool)
    members[list(group)] = True
    among = members[results.home] & members[results.away]
    mini = results.subset(among)
    totals = season_totals(mini, points)
    column = {
        "head_to_head_points": totals["points"],
        "head_to_head_goal_difference": totals["goal_difference"],
        "head_to_head_goals_scored": totals["goals_for"],
        "head_to_head_away_goals": totals["away_goals"],
    }[name]
    return {team: float(column[team]) for team in group}


@dataclass
class Tiebreaker:
    """Applies a competition's tiebreaker chain to one season's results.

    Args:
        chain: tiebreaker names in the order the competition applies them.
        points: the points system (needed for head-to-head points).
        reapply_head_to_head: when the head-to-head block leaves a smaller
            group still level, run the block again on just that group.
        rng: random source for ``coin_flip``. With ``random_tiebreaks=False``
            a coin flip is replaced by alphabetical order: the right choice for
            showing the *current* table, where teams level on everything are
            simply listed alphabetically, as official tables do.
    """

    chain: Sequence[str]
    points: PointsSystem
    reapply_head_to_head: bool = False
    rng: np.random.Generator | None = None
    random_tiebreaks: bool = True
    play_match: PlayMatch | None = None
    #: Some leagues (France) use head-to-head criteria only when every club in
    #: the tied group has met every other the full number of times; otherwise
    #: they move on to the next criterion. Matters mid-season, and in a season
    #: stopped early; never in a complete season.
    needs_all_meetings: int = 0

    def __post_init__(self) -> None:
        unknown = [c for c in self.chain if c not in KNOWN_TIEBREAKERS]
        if unknown:
            raise ValueError(f"unknown tiebreaker(s): {unknown}")
        self.chain = tuple(self.chain)
        if self.rng is None:
            self.rng = np.random.default_rng()

    @classmethod
    def from_config(cls, config: CompetitionConfig, **kwargs) -> "Tiebreaker":
        return cls(
            chain=config.tiebreakers,
            points=config.points,
            reapply_head_to_head=config.head_to_head_reapply,
            needs_all_meetings=config.league.meetings_per_pair
            if config.head_to_head_needs_all_meetings and config.league else 0,
            **kwargs,
        )

    # -- public ---------------------------------------------------------------
    def rank(
        self,
        results: SeasonResults,
        totals: Mapping[str, np.ndarray] | None = None,
        primary: np.ndarray | None = None,
    ) -> list[int]:
        """Team indices from first to last.

        ``primary`` is what clubs are ordered by before any tiebreaker: points
        by default, points per match for a season stopped early.
        """
        totals = totals if totals is not None else season_totals(results, self.points)
        key = totals["points"] if primary is None else primary
        by_key = sorted(range(results.n_teams), key=lambda team: -key[team])
        ranked: list[int] = []
        for _, group in groupby(by_key, key=lambda team: key[team]):
            ranked.extend(self.resolve(list(group), results, totals, start=0))
        return ranked

    def resolve(
        self,
        group: list[int],
        results: SeasonResults,
        totals: Mapping[str, np.ndarray],
        start: int = 0,
    ) -> list[int]:
        """Order a group of teams level on points, from criterion ``start`` on.

        ``start`` > 0 lets the simulator skip the season-wide criteria it has
        already applied in bulk.
        """
        if len(group) <= 1:
            return list(group)
        if start >= len(self.chain):
            return sorted(group, key=lambda team: results.teams[team])
        if self.chain[start] in HEAD_TO_HEAD_CRITERIA:
            return self._resolve_head_to_head_block(group, results, totals, start)

        values = self._values(self.chain[start], group, results, totals)
        out: list[int] = []
        for tied in self._split(group, values):
            out.extend(self.resolve(tied, results, totals, start=start + 1))
        return out

    # -- internals ------------------------------------------------------------
    def _resolve_head_to_head_block(
        self,
        group: list[int],
        results: SeasonResults,
        totals: Mapping[str, np.ndarray],
        start: int,
    ) -> list[int]:
        """Apply a run of head-to-head criteria as one block.

        Every criterion in the block is computed from the mini-table of
        ``group``, the teams level when the block started, even after earlier
        criteria in the block have separated some of them.
        """
        end = start
        while end < len(self.chain) and self.chain[end] in HEAD_TO_HEAD_CRITERIA:
            end += 1
        if self.needs_all_meetings and not self._all_met(group, results):
            return self.resolve(group, results, totals, start=end)

        partition = [list(group)]
        for name in self.chain[start:end]:
            values = _head_to_head_values(name, group, results, self.points)
            refined: list[list[int]] = []
            for part in partition:
                refined.extend(self._split(part, values) if len(part) > 1 else [part])
            partition = refined

        out: list[int] = []
        for part in partition:
            if len(part) > 1 and self.reapply_head_to_head and len(part) < len(group):
                # The block split the group only partly: run it again on the
                # teams still level, now using only the matches among *them*.
                out.extend(self._resolve_head_to_head_block(part, results, totals, start))
            else:
                out.extend(self.resolve(part, results, totals, start=end))
        return out

    def _all_met(self, group: Sequence[int], results: SeasonResults) -> bool:
        """Has every pair in ``group`` played each other the full number of times?"""
        members = np.zeros(results.n_teams, dtype=bool)
        members[list(group)] = True
        among = members[results.home] & members[results.away]
        pairs = len(group) * (len(group) - 1) // 2
        return int(among.sum()) >= pairs * self.needs_all_meetings

    @staticmethod
    def _split(group: Sequence[int], values: Mapping[int, float]) -> list[list[int]]:
        """Order ``group`` by ``values`` (highest first) and cut it into runs of equal value."""
        ordered = sorted(group, key=lambda team: -values[team])
        return [list(run) for _, run in groupby(ordered, key=lambda team: values[team])]

    def _values(
        self, name: str, group: Sequence[int], results: SeasonResults, totals: Mapping[str, np.ndarray]
    ) -> dict[int, float]:
        """A season-wide or ordering criterion for each team in ``group``."""
        if name in SEASON_CRITERIA:
            column = _season_criterion(name, totals)
            return {team: float(column[team]) for team in group}
        if name == "playoff_match" and self.random_tiebreaks and self.play_match and len(group) == 2:
            first, second = group
            winner = self.play_match(results.teams[first], results.teams[second], True)
            return {first: float(results.teams[first] == winner), second: float(results.teams[second] == winner)}
        if name in {"coin_flip", "playoff_match"} and self.random_tiebreaks:
            # A play-off between three or more clubs (never scheduled in
            # practice) falls back to a random order.
            draws = self.rng.random(len(group))
            return {team: float(draw) for team, draw in zip(group, draws)}
        # alphabetical (or a coin flip shown as alphabetical): earlier name ranks higher
        names = sorted(group, key=lambda team: results.teams[team])
        return {team: float(-position) for position, team in enumerate(names)}

    @property
    def leading_season_criteria(self) -> tuple[str, ...]:
        """The run of season-wide criteria at the start of the chain.

        These can be applied to thousands of simulated tables at once with a
        plain sort; only teams still level after them need :meth:`resolve`.
        """
        leading = []
        for name in self.chain:
            if name not in SEASON_CRITERIA:
                break
            leading.append(name)
        return tuple(leading)


# ---------------------------------------------------------------------------
# The table itself
# ---------------------------------------------------------------------------


def league_table(
    matches: pd.DataFrame,
    config: CompetitionConfig,
    season: str | None = None,
    *,
    teams: Sequence[str] | None = None,
    as_of: str | pd.Timestamp | None = None,
    deductions: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """The table for ``season`` from its played matches, with full tiebreakers.

    Uses the rules in force that season (``config.for_season``): its points
    system, tiebreakers and, for a season stopped early, points per match.
    Results awarded off the pitch (``configs/awarded_results.yaml``) replace the
    played score.
    A position play-off that was actually played (``configs/playoff_results.yaml``)
    decides the places it was played for.

    Points deductions (``configs/points_deductions.yaml``, or ``deductions``)
    are applied to the points total; with ``as_of``, only those dated before it,
    so a table rebuilt at a past date shows what the official one showed then.
    ``points_deducted`` reports the net change (negative = deducted).

    Teams level on every criterion are listed alphabetically rather than by a
    coin flip, as official tables are during a season.
    """
    season = season or config.current_season
    config = config.for_season(season)
    rows = matches.loc[matches["season"].astype(str) == season]
    rows = apply_awarded_results(rows, config.id, as_of=as_of)
    if teams is None:
        teams = sorted(set(rows["home_team"]) | set(rows["away_team"]))
    results = SeasonResults.from_matches(rows, teams)
    tiebreaker = Tiebreaker.from_config(config, random_tiebreaks=False)
    totals = season_totals(results, config.points)
    adjustment = points_adjustments(config.id, season, results.teams, as_of=as_of, deductions=deductions)
    totals = with_points_adjustment(totals, adjustment)
    primary = None
    if config.ranking == "points_per_match":
        primary = totals["points"] / np.maximum(totals["played"], 1)
    order = tiebreaker.rank(results, totals, primary)
    order = _apply_recorded_playoffs(order, results, totals, config, season)

    table = pd.DataFrame(
        {
            "team": [results.teams[i] for i in order],
            "played": totals["played"][order],
            "won": totals["wins"][order],
            "drawn": totals["draws"][order],
            "lost": totals["losses"][order],
            "goals_for": totals["goals_for"][order],
            "goals_against": totals["goals_against"][order],
            "goal_difference": totals["goal_difference"][order],
            "points": totals["points"][order],
            "points_deducted": adjustment[order],
        }
    )
    table.insert(0, "position", range(1, len(table) + 1))
    return table


__all__ = [
    "HEAD_TO_HEAD_CRITERIA",
    "ORDERING_CRITERIA",
    "SEASON_CRITERIA",
    "SeasonResults",
    "Tiebreaker",
    "league_table",
    "result_points",
    "season_totals",
    "with_points_adjustment",
]
