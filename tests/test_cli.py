"""Smoke tests: every CLI command runs end to end and exits cleanly.

The CLI catches exceptions and reports them as one line, so a broken command
would otherwise only be noticed by running it. Skipped when the raw data is not
cached, so the suite stays offline.
"""

from __future__ import annotations

import pytest

from tabletalk.cli import main
from tabletalk.data.loaders import build_loaders


@pytest.fixture(autouse=True)
def _needs_cached_data(premier_league):
    for loader in build_loaders(premier_league):
        if any(not loader.cache_path(season).exists() for season in loader.seasons):
            pytest.skip("raw data not cached; run `python -m tabletalk data fetch` first")


@pytest.mark.parametrize(
    "argv",
    [
        ["competitions"],
        ["data", "check", "-c", "premier_league"],
        ["ratings", "-c", "premier_league", "--fixtures", "3"],
        ["simulate", "-c", "premier_league", "--n-simulations", "300"],
        ["simulate", "-c", "premier_league", "--season", "2025-26", "--as-of", "2026-01-01",
         "--n-simulations", "300", "--positions"],
        ["evaluate", "-c", "premier_league", "--seasons", "2025-26", "--strategies", "prior",
         "--refit-days", "60"],
        ["simulate", "-c", "premier_league", "--n-simulations", "300", "--table"],
        ["evaluate-seasons", "-c", "premier_league", "--seasons", "2025-26", "--n-simulations", "200"],
    ],
    ids=["competitions", "data-check", "ratings", "simulate", "simulate-replay", "evaluate",
         "simulate-table", "evaluate-seasons"],
)
def test_command_runs(argv, capsys):
    assert main(argv) == 0
    captured = capsys.readouterr()
    assert "error:" not in captured.err
    assert captured.out.strip()
