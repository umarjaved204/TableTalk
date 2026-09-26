"""Data layer: one standard match frame, whatever the source.

    from tabletalk.config import load_competition
    from tabletalk.data import load_matches

    config = load_competition("premier_league")
    matches = load_matches(config)          # date, teams, goals, neutral, played

Submodules:
    schema     - the standard columns and their validation
    seasons    - season labels ("2025-26") and source-specific codes
    normalise  - team-name normalisation from configs/team_aliases.yaml
    loaders    - one class per source, all producing the standard schema
    fixtures   - the remaining fixtures, and checking the schedule against the config
    reconcile  - merging a results source with the published fixture list
    dataset    - assembling, filtering and summarising a competition's matches
"""

from .dataset import filter_matches, load_matches, season_summary, team_seasons
from .fixtures import (
    check_fixture_list,
    remaining_fixtures,
    require_valid_fixture_list,
    season_progress,
    season_teams,
)
from .reconcile import combine_results_and_fixtures
from .normalise import TeamNameNormaliser, UnknownTeamError, default_normaliser
from .schema import MATCH_COLUMNS, SchemaError, validate_matches
from .seasons import Season, canonical_season

__all__ = [
    "MATCH_COLUMNS",
    "Season",
    "SchemaError",
    "TeamNameNormaliser",
    "UnknownTeamError",
    "canonical_season",
    "default_normaliser",
    "filter_matches",
    "load_matches",
    "check_fixture_list",
    "combine_results_and_fixtures",
    "remaining_fixtures",
    "require_valid_fixture_list",
    "season_progress",
    "season_summary",
    "season_teams",
    "team_seasons",
    "validate_matches",
]
