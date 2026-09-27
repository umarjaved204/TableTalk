"""LeagueSimulator: play out the rest of a league season thousands of times.

The simulator knows the competition's rules (from the config) and asks the
match model one question per remaining fixture: "what is the probability of
every scoreline?". It knows nothing about how those probabilities are made.

One simulation
--------------
1. Start from the real table (matches already played).
2. For every remaining fixture, draw a scoreline from the model's score matrix.
3. Add the simulated results to the real ones and rank the final table with the
   config's points system and tiebreakers.

Repeat 10,000 times and count: how often each team finished in each position,
and therefore in each zone the config defines (title, top four, relegation...).

How it is fast
--------------
* Each fixture's score matrix is computed once, not once per simulation: the
  model's probabilities do not change between runs.
* All simulations are drawn at once as arrays (fixtures x simulations), and the
  tables are built with a matrix product rather than a loop over matches.
* Tables are sorted in bulk on points plus the leading season-wide tiebreakers
  (for the Premier League: goal difference, then goals scored). Only simulations
  where teams are *still* level - under 1% for the Premier League - go through
  the exact, slower tiebreaker engine for the head-to-head criteria.

Strength uncertainty
--------------------
With a ``StrengthUncertainty`` (see ``simulation.uncertainty``), each simulated
season draws its own ratings from the fit's uncertainty and lets them drift
through the season, so outcomes are as spread out as our real ignorance says
they should be. Scorelines are then sampled per run rather than from one shared
score matrix per fixture. Without it (``FIXED``), every run uses today's best
estimates for every fixture: faster, but the season backtest shows it makes
forecasts made months ahead over-confident.

Monte Carlo error
-----------------
With N simulations, a reported probability p carries a standard error of
sqrt(p(1-p)/N): at N = 10,000, a 50% figure is good to about ±1 percentage point
(95% interval) and a 2% figure to about ±0.3 points.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from ..config import CompetitionConfig, Zone
from ..data.fixtures import remaining_fixtures, season_teams
from ..model.dixon_coles import FittedDixonColes
from ..data.deductions import points_adjustments
from .table import (
    SeasonResults,
    Tiebreaker,
    _season_criterion,
    league_table,
    result_points,
    season_totals,
    with_points_adjustment,
)
from .uncertainty import FIXED, StrengthUncertainty, simulate_fixtures


@dataclass
class LeagueSimulationResult:
    """Every simulated final table, plus summaries of them."""

    competition: str
    competition_name: str
    season: str
    teams: tuple[str, ...]
    zones: tuple[Zone, ...]
    positions: np.ndarray          # (n_simulations, n_teams), 1 = champions
    points: np.ndarray             # (n_simulations, n_teams) final points
    goal_difference: np.ndarray    # (n_simulations, n_teams) final goal difference
    current_table: pd.DataFrame
    n_remaining: int
    seed: int | None
    model_as_of: pd.Timestamp | None = None
    exact_tiebreaks: int = 0       # simulations that needed the exact tiebreaker engine
    expected_record: pd.DataFrame | None = None  # mean final W/D/L/GF/GA per team
    metadata: dict = field(default_factory=dict)

    @property
    def n_simulations(self) -> int:
        return int(self.positions.shape[0])

    def position_probabilities(self) -> pd.DataFrame:
        """P(team finishes in position k): rows are teams, columns 1..n_teams."""
        n_teams = len(self.teams)
        counts = np.stack(
            [np.bincount(self.positions[:, t] - 1, minlength=n_teams) for t in range(n_teams)]
        )
        return pd.DataFrame(
            counts / self.n_simulations, index=list(self.teams), columns=range(1, n_teams + 1)
        )

    def zone_probabilities(self) -> pd.DataFrame:
        """P(team finishes inside each configured zone)."""
        data = {
            zone.id: np.isin(self.positions, zone.positions).mean(axis=0) for zone in self.zones
        }
        return pd.DataFrame(data, index=list(self.teams))

    def summary(self) -> pd.DataFrame:
        """One row per team, ordered by expected final position."""
        current = self.current_table.set_index("team")
        positions = self.position_probabilities()
        frame = pd.DataFrame(
            {
                "position_now": current.loc[list(self.teams), "position"].to_numpy(),
                "points_now": current.loc[list(self.teams), "points"].to_numpy(),
                "expected_points": self.points.mean(axis=0),
                "points_p10": np.percentile(self.points, 10, axis=0),
                "points_p90": np.percentile(self.points, 90, axis=0),
                "expected_goal_difference": self.goal_difference.mean(axis=0),
                "expected_position": self.positions.mean(axis=0),
                "most_likely_position": positions.to_numpy().argmax(axis=1) + 1,
            },
            index=list(self.teams),
        )
        frame = frame.join(self.zone_probabilities())
        frame.index.name = "team"
        return frame.sort_values("expected_position")

    def standard_error(self, probability: float | np.ndarray) -> float | np.ndarray:
        """Monte Carlo standard error of a probability estimated from these runs."""
        p = np.asarray(probability, dtype=float)
        return np.sqrt(p * (1 - p) / self.n_simulations)


class LeagueSimulator:
    """Simulates the remainder of a round-robin league season."""

    def __init__(
        self,
        config: CompetitionConfig,
        model: FittedDixonColes,
        uncertainty: StrengthUncertainty = FIXED,
    ):
        if config.league is None:
            raise ValueError(f"{config.id} has no `league:` section to simulate")
        self.config = config
        self.model = model
        self.uncertainty = uncertainty

    def simulate(
        self,
        matches: pd.DataFrame,
        *,
        season: str | None = None,
        n_simulations: int | None = None,
        seed: int | None = None,
        as_of: str | pd.Timestamp | None = None,
    ) -> LeagueSimulationResult:
        """Simulate the season's unplayed fixtures on top of its played ones.

        ``as_of`` only affects points deductions: those dated before it are
        applied (all of them when None), matching a replay from that date.
        """
        config = self.config
        season = season or config.current_season
        n_simulations = int(n_simulations or config.simulation.get("n_simulations", 10_000))
        if seed is None:
            seed = config.simulation.get("random_seed")
        rng = np.random.default_rng(seed)

        own = matches.loc[matches["competition"].astype(str) == config.id]
        teams = tuple(season_teams(own, season))
        if len(teams) != config.league.n_teams:
            raise ValueError(
                f"{config.id} {season}: {len(teams)} teams in the data, config says "
                f"{config.league.n_teams}"
            )
        index = {team: i for i, team in enumerate(teams)}
        n_teams = len(teams)

        season_rows = own.loc[own["season"].astype(str) == season]
        played = SeasonResults.from_matches(season_rows, teams)
        # Deductions are a constant per team: add them once, to the starting
        # points, and every simulated final table inherits them.
        base = with_points_adjustment(
            season_totals(played, config.points), points_adjustments(config.id, season, teams, as_of=as_of)
        )
        fixtures = remaining_fixtures(own, config, season)

        # --- 1. simulate every remaining fixture in every run -------------------
        home_idx = fixtures["home_team"].map(index).to_numpy(dtype=int)
        away_idx = fixtures["away_team"].map(index).to_numpy(dtype=int)
        if self.uncertainty.active:
            days_ahead = (fixtures["date"] - self.model.as_of).dt.days.to_numpy(dtype=float)
            sim_home_goals, sim_away_goals = simulate_fixtures(
                self.model,
                self.uncertainty,
                fixtures["home_team"].tolist(),
                fixtures["away_team"].tolist(),
                days_ahead,
                fixtures["neutral"].fillna(False).to_numpy(dtype=bool),
                n_simulations,
                rng,
            )
        else:
            sim_home_goals, sim_away_goals = self._sample_scores(fixtures, n_simulations, rng)

        # --- 2. final totals for every team in every run --------------------------
        totals = self._final_totals(base, home_idx, away_idx, sim_home_goals, sim_away_goals, n_teams)

        # --- 3. rank every simulated table ---------------------------------------
        tiebreaker = Tiebreaker.from_config(config, rng=rng)
        order, exact = self._rank(
            totals, tiebreaker, played, home_idx, away_idx, sim_home_goals, sim_away_goals
        )
        positions = np.empty_like(order)
        np.put_along_axis(positions, order, np.arange(1, n_teams + 1)[None, :], axis=1)

        return LeagueSimulationResult(
            competition=config.id,
            competition_name=config.name,
            season=season,
            teams=teams,
            zones=config.zones,
            positions=positions,
            points=totals["points"],
            goal_difference=totals["goal_difference"],
            expected_record=pd.DataFrame(
                {
                    "won": totals["wins"].mean(axis=0),
                    "drawn": totals["draws"].mean(axis=0),
                    "lost": config.league.matches_per_team - totals["wins"].mean(axis=0) - totals["draws"].mean(axis=0),
                    "goals_for": totals["goals_for"].mean(axis=0),
                    "goals_against": totals["goals_against"].mean(axis=0),
                },
                index=list(teams),
            ),
            current_table=league_table(own, config, season, teams=teams, as_of=as_of),
            n_remaining=len(fixtures),
            seed=seed,
            model_as_of=self.model.as_of,
            exact_tiebreaks=exact,
        )

    # -- internals ------------------------------------------------------------
    def _sample_scores(
        self, fixtures: pd.DataFrame, n_simulations: int, rng: np.random.Generator
    ) -> tuple[np.ndarray, np.ndarray]:
        """Draw a scoreline for each fixture in each run: arrays (fixtures, runs).

        Inverse-CDF sampling: flatten the fixture's score matrix, take its
        running total, and find where a uniform random number lands in it.
        """
        n_fixtures = len(fixtures)
        grid = self.model.max_goals + 1
        if n_fixtures == 0:
            empty = np.zeros((0, n_simulations), dtype=np.int16)
            return empty, empty.copy()
        cells = np.empty((n_fixtures, n_simulations), dtype=np.int32)
        uniforms = rng.random((n_fixtures, n_simulations))
        for k, fixture in enumerate(fixtures.itertuples(index=False)):
            matrix = self.model.score_matrix(
                fixture.home_team, fixture.away_team, neutral=bool(getattr(fixture, "neutral", False))
            )
            cdf = np.cumsum(matrix.ravel())
            cells[k] = np.searchsorted(cdf, uniforms[k], side="right")
        np.clip(cells, 0, grid * grid - 1, out=cells)  # guards against cdf[-1] = 0.9999999
        home_goals, away_goals = np.divmod(cells, grid)
        return home_goals.astype(np.int16), away_goals.astype(np.int16)

    def _final_totals(
        self,
        base: dict[str, np.ndarray],
        home_idx: np.ndarray,
        away_idx: np.ndarray,
        home_goals: np.ndarray,
        away_goals: np.ndarray,
        n_teams: int,
    ) -> dict[str, np.ndarray]:
        """Played totals plus simulated ones, as (runs, teams) arrays.

        ``home_matrix[k, t]`` is 1 when team t is at home in fixture k, so
        ``values.T @ home_matrix`` adds each fixture's value to its home team in
        every run at once.
        """
        n_fixtures = len(home_idx)
        home_matrix = np.zeros((n_fixtures, n_teams))
        away_matrix = np.zeros((n_fixtures, n_teams))
        home_matrix[np.arange(n_fixtures), home_idx] = 1.0
        away_matrix[np.arange(n_fixtures), away_idx] = 1.0
        points = self.config.points

        def add(home_values, away_values, base_key):
            simulated = home_values.T.astype(float) @ home_matrix + away_values.T.astype(float) @ away_matrix
            return np.rint(simulated).astype(np.int32) + base[base_key][None, :]

        zeros = np.zeros_like(home_goals)
        totals = {
            "points": add(result_points(home_goals, away_goals, points), result_points(away_goals, home_goals, points), "points"),
            "goals_for": add(home_goals, away_goals, "goals_for"),
            "goals_against": add(away_goals, home_goals, "goals_against"),
            "wins": add((home_goals > away_goals), (away_goals > home_goals), "wins"),
            "draws": add((home_goals == away_goals), (home_goals == away_goals), "draws"),
            "away_goals": add(zeros, away_goals, "away_goals"),
        }
        totals["goal_difference"] = totals["goals_for"] - totals["goals_against"]
        return totals

    def _rank(
        self,
        totals: dict[str, np.ndarray],
        tiebreaker: Tiebreaker,
        played: SeasonResults,
        home_idx: np.ndarray,
        away_idx: np.ndarray,
        sim_home_goals: np.ndarray,
        sim_away_goals: np.ndarray,
    ) -> tuple[np.ndarray, int]:
        """Team order (runs, teams) for every run, and how many needed the exact path."""
        n_runs, n_teams = totals["points"].shape
        leading = tiebreaker.leading_season_criteria
        keys = [totals["points"]] + [_season_criterion(name, totals) for name in leading]

        # Bulk sort: np.lexsort's *last* key is the primary one, so the run
        # index goes last (keeps each run's teams together), then points, then
        # the tiebreakers; all negated because higher ranks first.
        run_ids = np.repeat(np.arange(n_runs), n_teams)
        flat = np.lexsort([-k.ravel() for k in reversed(keys)] + [run_ids])
        order = (flat % n_teams).reshape(n_runs, n_teams)

        # Where are teams still level on every key used so far?
        sorted_keys = [np.take_along_axis(k, order, axis=1) for k in keys]
        level = np.ones((n_runs, n_teams - 1), dtype=bool)
        for k in sorted_keys:
            level &= k[:, 1:] == k[:, :-1]
        runs_with_ties = np.flatnonzero(level.any(axis=1))

        for run in runs_with_ties:
            results = SeasonResults(
                teams=played.teams,
                home=np.concatenate([played.home, home_idx]),
                away=np.concatenate([played.away, away_idx]),
                home_goals=np.concatenate([played.home_goals, sim_home_goals[:, run]]),
                away_goals=np.concatenate([played.away_goals, sim_away_goals[:, run]]),
            )
            run_totals = {name: values[run] for name, values in totals.items()}
            row = list(order[run])
            position = 0
            while position < n_teams:
                end = position
                while end < n_teams - 1 and level[run, end]:
                    end += 1
                if end > position:
                    group = row[position : end + 1]
                    row[position : end + 1] = tiebreaker.resolve(
                        group, results, run_totals, start=len(leading)
                    )
                position = end + 1
            order[run] = row
        return order, int(len(runs_with_ties))


def simulate_league(
    config: CompetitionConfig,
    matches: pd.DataFrame,
    context: pd.DataFrame | None = None,
    *,
    n_simulations: int | None = None,
    seed: int | None = None,
    strategy: str | None = None,
    as_of: str | pd.Timestamp | None = None,
    season: str | None = None,
    prior=None,
    fixed_strengths: bool = False,
    strength_uncertainty: dict | None = None,
) -> LeagueSimulationResult:
    """Fit the match model and simulate the season in one call.

    ``as_of`` fits on results before that date and simulates everything from
    there, which is how a past season is replayed from a chosen point (the
    season-level backtest). By default, everything played so far is used.
    ``prior`` is a precomputed promoted-team prior, so a backtest replaying the
    same season from several dates estimates it once.

    Strength uncertainty follows the config's ``simulation.strength_uncertainty``
    block, or ``strength_uncertainty`` if given (same keys, for comparing
    variants); ``fixed_strengths=True`` switches it off (today's ratings for
    every run).
    """
    from ..model.promoted import fit_competition_model

    season = season or config.current_season
    # A config without a `strength_uncertainty` block simulates fixed strengths.
    if strength_uncertainty is not None:
        settings = dict(strength_uncertainty)
    else:
        settings = config.simulation.get("strength_uncertainty") or {}
    wants_uncertainty = bool(settings) and bool(settings.get("enabled", True)) and not fixed_strengths
    fit = fit_competition_model(
        config, matches, context, season=season, as_of=as_of, strategy=strategy, prior=prior,
        compute_covariance=wants_uncertainty and bool(settings.get("parameter_uncertainty", True)),
    )
    uncertainty = StrengthUncertainty.from_config(settings, fit.model) if wants_uncertainty else FIXED
    frame = matches
    if as_of is not None:
        # Forget results on or after as_of: they become fixtures to simulate.
        frame = matches.copy()
        future = (frame["season"].astype(str) == season) & (frame["date"] >= pd.Timestamp(as_of))
        frame.loc[future, ["home_goals", "away_goals"]] = pd.NA
        frame.loc[future, "played"] = False
    result = LeagueSimulator(config, fit.model, uncertainty).simulate(
        frame, season=season, n_simulations=n_simulations, seed=seed, as_of=as_of
    )
    result.metadata.update({"strategy": fit.strategy, "promoted": fit.promoted, "uncertainty": uncertainty})
    return result
