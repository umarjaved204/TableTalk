"""Rating teams that have just been promoted.

The problem: a Dixon-Coles fit rates each team from its own results. A team
promoted this season has few or no top-flight results, so its rating is either
missing or estimated from a handful of matches. Left alone, the fit reads five
games of good luck as a top-five team.

Two strategies, selected by ``model.promoted_teams.strategy`` in the config:

``prior``
    Start every promoted team at the average first-season rating of teams
    promoted in previous seasons, with a spread equal to how much those teams
    varied. Their own results then pull them away from that starting point, and
    by the end of the season the data dominates. Needs no extra data, but treats
    every promoted team as the same team before a ball is kicked.

``second_tier``
    Fit the second division alongside the top flight (the config's ``context``
    source). A promoted team then carries a rating earned in the Championship,
    placed on the Premier League's scale by the clubs that move between the two
    divisions each season. Team-specific, and it is how most public rating
    systems (Elo-style, SPI) handle promotion. The cost is an assumption: that a
    club's strength is continuous across promotion, when promoted clubs in fact
    strengthen their squads and relegated clubs lose players.

Both are evaluated on the same match-level backtest (``tabletalk.evaluation``).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Mapping

import numpy as np
import pandas as pd

from ..config import CompetitionConfig
from ..data.seasons import Season
from .dixon_coles import DixonColesModel, FittedDixonColes, TeamPrior

logger = logging.getLogger(__name__)

STRATEGIES = ("prior", "second_tier", "none")


# ---------------------------------------------------------------------------
# Who is promoted?
# ---------------------------------------------------------------------------


def previous_season(season: str) -> str:
    parsed = Season.parse(season)
    return Season(parsed.start_year - 1, parsed.spans_two_years).label


def teams_in_season(matches: pd.DataFrame, competition: str, season: str) -> set[str]:
    rows = matches.loc[
        (matches["competition"].astype(str) == competition)
        & (matches["season"].astype(str) == season)
    ]
    return set(rows["home_team"].astype(str)) | set(rows["away_team"].astype(str))


def promoted_teams(matches: pd.DataFrame, competition: str, season: str) -> list[str] | None:
    """Teams in ``season`` that were not in the previous season of the same competition.

    Returns None when the previous season is not in the data, because "we
    cannot tell" is different from "nobody was promoted".
    """
    before = teams_in_season(matches, competition, previous_season(season))
    if not before:
        return None
    return sorted(teams_in_season(matches, competition, season) - before)


# ---------------------------------------------------------------------------
# Strategy "prior": what do promoted teams usually look like?
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PromotedPrior:
    """Average first-season rating of past promoted teams."""

    attack: float
    defence: float
    sd: float
    n_teams: int
    seasons: tuple[str, ...]
    examples: tuple[tuple[str, str, float, float], ...]  # (season, team, attack, defence)

    def as_team_prior(self) -> TeamPrior:
        return TeamPrior(attack=self.attack, defence=self.defence, sd=self.sd)

    def describe(self) -> str:
        return (
            f"promoted-team prior from {self.n_teams} teams in {len(self.seasons)} season(s) "
            f"({', '.join(self.seasons)}): attack {self.attack:+.3f} (x{np.exp(self.attack):.2f} goals), "
            f"defence {self.defence:+.3f} (x{np.exp(-self.defence):.2f} conceded), sd {self.sd:.3f}"
        )


def estimate_promoted_prior(
    matches: pd.DataFrame,
    competition: str,
    before_season: str,
    *,
    rating_prior_sd: float = 1.0,
    min_sd: float = 0.05,
) -> PromotedPrior | None:
    """Estimate the prior from completed seasons strictly before ``before_season``.

    Method: for each earlier season that has a predecessor in the data (so we
    can tell who was promoted), fit that season on its own, without time decay,
    and record the promoted teams' attack and defence. The prior is the average
    of those ratings; its sd is their spread.

    Each single-season fit has ratings centred on that season's league average,
    so ratings from different seasons are on a comparable scale.

    Only seasons before ``before_season`` are used, so a backtest of season S
    never sees S's results through the prior. Returns None if no season
    qualifies.
    """
    target = Season.parse(before_season)
    own = matches.loc[matches["competition"].astype(str) == competition]
    candidates = sorted(
        {str(s) for s in own["season"].astype(str)},
        key=lambda label: Season.parse(label).start_year,
    )

    model = DixonColesModel(half_life_days=None, rating_prior_sd=rating_prior_sd)
    samples: list[tuple[str, str, float, float]] = []
    used: list[str] = []
    for season in candidates:
        if Season.parse(season).start_year >= target.start_year:
            continue
        promoted = promoted_teams(own, competition, season)
        if not promoted:
            continue
        season_rows = own.loc[own["season"].astype(str) == season]
        fit = model.fit(season_rows, base_division=competition)
        ratings = fit.ratings(promoted)
        for row in ratings.itertuples(index=False):
            samples.append((season, row.team, float(row.attack), float(row.defence)))
        used.append(season)

    if not samples:
        return None
    attack = np.array([s[2] for s in samples])
    defence = np.array([s[3] for s in samples])
    # One shared sd for attack and defence keeps the prior to three numbers.
    # With a single sample there is no spread to measure, so fall back to the
    # generic prior width.
    if len(samples) > 1:
        sd = float(np.sqrt((attack.var(ddof=1) + defence.var(ddof=1)) / 2))
    else:
        sd = rating_prior_sd
    return PromotedPrior(
        attack=float(attack.mean()),
        defence=float(defence.mean()),
        sd=max(sd, min_sd),
        n_teams=len(samples),
        seasons=tuple(used),
        examples=tuple(samples),
    )


# ---------------------------------------------------------------------------
# Fitting a competition's model with a chosen strategy
# ---------------------------------------------------------------------------


@dataclass
class CompetitionFit:
    """A fitted model plus the promoted-team decisions that went into it."""

    model: FittedDixonColes
    strategy: str
    season: str
    promoted: list[str] | None
    prior: PromotedPrior | None


def fit_competition_model(
    config: CompetitionConfig,
    matches: pd.DataFrame,
    context: pd.DataFrame | None = None,
    *,
    season: str | None = None,
    as_of: str | pd.Timestamp | None = None,
    strategy: str | None = None,
    half_life_days: float | None = None,
    prior: PromotedPrior | None = None,
    compute_covariance: bool = False,
) -> CompetitionFit:
    """Fit the match model for predicting ``season`` of a competition.

    Args:
        matches: the competition's own matches (``load_matches``), including the
            season's unplayed fixtures, which tell us who is in the league.
        context: second-tier results (``load_context_matches``); required for
            the ``second_tier`` strategy, ignored otherwise.
        as_of: fit date; only results before it are used. Defaults to "now",
            i.e. after the last played match.
        strategy: ``prior``, ``second_tier`` or ``none`` (no special handling;
            kept to show what goes wrong without it). Defaults to the config.
        prior: a precomputed PromotedPrior, so a backtest refitting every week
            does not re-estimate it every time.
        compute_covariance: also estimate parameter uncertainty (needed to
            simulate with strength uncertainty).
    """
    season = season or config.current_season
    promoted_config: Mapping = config.model.get("promoted_teams", {}) or {}
    strategy = strategy or promoted_config.get("strategy", "prior")
    if strategy not in STRATEGIES:
        raise ValueError(f"unknown promoted-team strategy {strategy!r}; expected one of {STRATEGIES}")

    model = DixonColesModel.from_config(config.model, half_life_days=half_life_days)
    own = matches.loc[matches["competition"].astype(str) == config.id]
    # Everyone in this season's league must get a rating, including a promoted
    # team that has not played yet. The season's participants are known before
    # it starts, so using them is not look-ahead.
    season_teams = sorted(teams_in_season(own, config.id, season))
    promoted = promoted_teams(own, config.id, season)

    priors: dict[str, TeamPrior] = {}
    train = own
    if strategy == "prior":
        if prior is None:
            prior = estimate_promoted_prior(
                own, config.id, season, rating_prior_sd=model.rating_prior_sd
            )
        min_seasons = int(promoted_config.get("min_seasons_for_prior", 1))
        if prior is None or len(prior.seasons) < min_seasons:
            logger.warning(
                "%s %s: not enough history to estimate a promoted-team prior; "
                "promoted teams fall back to the generic prior",
                config.id,
                season,
            )
        elif promoted:
            priors = {team: prior.as_team_prior() for team in promoted}
    elif strategy == "second_tier":
        if context is None or context.empty:
            raise ValueError(
                f"{config.id}: strategy 'second_tier' needs context matches "
                "(add a `role: context` data source and pass load_context_matches())"
            )
        train = pd.concat([own, context], ignore_index=True)

    fitted = model.fit(
        train,
        as_of=as_of,
        teams=season_teams,
        priors=priors,
        base_division=config.id,
        compute_covariance=compute_covariance,
    )
    return CompetitionFit(
        model=fitted,
        strategy=strategy,
        season=season,
        promoted=promoted,
        prior=prior if strategy == "prior" else None,
    )
