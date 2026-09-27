"""Promoted-team handling: detection, the prior, and leak-free estimation."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from tabletalk.model.promoted import (
    estimate_promoted_prior,
    fit_competition_model,
    previous_season,
    promoted_teams,
)


# These tests use tiny synthetic seasons (12 matches), far too few to pin down
# rho, so the optimiser legitimately reports it at its bound.
pytestmark = pytest.mark.filterwarnings("ignore:rho=.*search bound")

def _season(teams, season, competition="toy_league", seed=0, boost=None):
    """A double round robin for ``teams`` with random scores.

    ``boost`` maps a team to extra goals it scores in every match, to make a
    team deliberately strong or weak.
    """
    rng = np.random.default_rng(seed)
    boost = boost or {}
    rows = []
    date = pd.Timestamp(f"{season[:4]}-08-01")
    for home in teams:
        for away in teams:
            if home == away:
                continue
            hg = rng.poisson(1.5) + boost.get(home, 0)
            ag = rng.poisson(1.1) + boost.get(away, 0)
            rows.append((date, competition, season, home, away, max(hg, 0), max(ag, 0), False, True))
            date += pd.Timedelta(days=3)
    return pd.DataFrame(
        rows,
        columns=["date", "competition", "season", "home_team", "away_team",
                 "home_goals", "away_goals", "neutral", "played"],
    )


def test_previous_season():
    assert previous_season("2025-26") == "2024-25"
    assert previous_season("2000-01") == "1999-00"


def test_promoted_teams_are_the_newcomers():
    matches = pd.concat([_season(list("ABCD"), "2023-24"), _season(list("ABCE"), "2024-25")])
    assert promoted_teams(matches, "toy_league", "2024-25") == ["E"]


def test_promoted_teams_unknown_without_the_previous_season():
    matches = _season(list("ABCD"), "2024-25")
    assert promoted_teams(matches, "toy_league", "2024-25") is None


def _three_seasons(newcomer_boost_in_last: int = 0):
    return pd.concat(
        [
            _season(list("ABCDEF"), "2022-23", seed=1),
            _season(list("ABCDEG"), "2023-24", seed=2, boost={"G": -1}),  # weak newcomer
            _season(list("ABCDEH"), "2024-25", seed=3, boost={"H": newcomer_boost_in_last}),
        ],
        ignore_index=True,
    )


def test_prior_reflects_how_past_newcomers_did():
    prior = estimate_promoted_prior(_three_seasons(), "toy_league", "2024-25")
    assert prior.seasons == ("2023-24",)
    assert prior.n_teams == 1
    assert prior.attack < 0  # G scored a goal a game less than everyone else


def test_prior_never_sees_the_season_it_is_for():
    """Changing the target season's own results must not move its prior."""
    quiet = estimate_promoted_prior(_three_seasons(0), "toy_league", "2024-25")
    extreme = estimate_promoted_prior(_three_seasons(4), "toy_league", "2024-25")
    assert quiet.attack == pytest.approx(extreme.attack)
    assert quiet.defence == pytest.approx(extreme.defence)


def test_prior_strategy_starts_a_newcomer_at_the_prior(four_team_config):
    history = pd.concat(
        [
            _season(list("ABCD"), "2023-24", seed=1),
            _season(list("ABCE"), "2024-25", seed=2, boost={"E": -1}),
            _season(list("ABCF"), "2025-26", seed=3),
        ],
        ignore_index=True,
    )
    first_day = history.loc[history["season"] == "2025-26", "date"].min()
    fit = fit_competition_model(four_team_config, history, season="2025-26", as_of=first_day, strategy="prior")
    assert fit.promoted == ["F"]
    newcomer = fit.model.ratings(["F"]).iloc[0]
    assert newcomer["matches"] == 0
    assert newcomer["attack"] == pytest.approx(fit.prior.attack, abs=1e-5)
    assert newcomer["defence"] == pytest.approx(fit.prior.defence, abs=1e-5)


def test_none_strategy_treats_a_newcomer_as_average(four_team_config):
    history = pd.concat([_season(list("ABCD"), "2024-25"), _season(list("ABCF"), "2025-26")])
    first_day = history.loc[history["season"] == "2025-26", "date"].min()
    fit = fit_competition_model(four_team_config, history, season="2025-26", as_of=first_day, strategy="none")
    assert fit.model.ratings(["F"]).iloc[0]["attack"] == pytest.approx(0.0, abs=1e-5)


def test_second_tier_strategy_requires_context(four_team_config):
    history = _season(list("ABCD"), "2025-26")
    with pytest.raises(ValueError, match="needs context matches"):
        fit_competition_model(four_team_config, history, strategy="second_tier")


def test_second_tier_strategy_rates_a_newcomer_from_the_lower_division(four_team_config):
    top = pd.concat([_season(list("ABCD"), "2024-25", seed=1), _season(list("ABCF"), "2025-26", seed=2)])
    lower = _season(list("DFGH"), "2024-25", competition="toy_second", seed=3, boost={"F": 2})
    first_day = top.loc[top["season"] == "2025-26", "date"].min()
    fit = fit_competition_model(
        four_team_config, top, lower, season="2025-26", as_of=first_day, strategy="second_tier"
    )
    newcomer = fit.model.ratings(["F"]).iloc[0]
    assert newcomer["matches"] > 0          # it has second-tier history
    assert newcomer["attack"] > 0.2         # and it dominated down there
    assert "toy_second" in fit.model.division_offsets


def test_unknown_strategy_is_rejected(four_team_config):
    with pytest.raises(ValueError, match="unknown promoted-team strategy"):
        fit_competition_model(four_team_config, _season(list("ABCD"), "2025-26"), strategy="vibes")


def test_prior_is_identical_with_every_later_season_deleted():
    """Walk-forward check: the prior for a season is the same whether or not the
    data also holds that season and everything after it."""
    history = pd.concat(
        [
            _three_seasons(),
            _season(list("ABCDEI"), "2025-26", seed=4, boost={"I": 3}),
        ],
        ignore_index=True,
    )
    full = estimate_promoted_prior(history, "toy_league", "2024-25")
    truncated = estimate_promoted_prior(
        history.loc[history["season"].isin(["2022-23", "2023-24"])], "toy_league", "2024-25"
    )
    assert full == truncated
