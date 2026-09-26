"""Competition simulators: turn match probabilities into table probabilities."""

from .league import LeagueSimulationResult, LeagueSimulator, simulate_league
from .table import SeasonResults, Tiebreaker, league_table, season_totals

__all__ = [
    "LeagueSimulationResult",
    "LeagueSimulator",
    "SeasonResults",
    "Tiebreaker",
    "league_table",
    "season_totals",
    "simulate_league",
]
