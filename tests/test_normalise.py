"""Team-name normalisation.

Getting this wrong splits one club into two weaker teams, or merges two clubs,
and the model would look fine while being wrong. Hence the paranoid tests.
"""

from __future__ import annotations

import pandas as pd
import pytest

from tabletalk.data.normalise import (
    TeamNameNormaliser,
    UnknownTeamError,
    default_normaliser,
    fingerprint,
)


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("Arsenal", "arsenal"),
        ("Arsenal FC", "arsenal"),
        ("A.F.C. Bournemouth", "bournemouth"),
        ("Atlético Madrid", "atletico madrid"),
        ("Brighton & Hove Albion", "brighton and hove albion"),
        ("  MAN   United  ", "man united"),
        ("Nott'm Forest", "nottm forest"),
    ],
)
def test_fingerprint(raw, expected):
    assert fingerprint(raw) == expected


def test_fingerprint_never_empties_a_name():
    """A club literally called "FC" must not normalise away to nothing."""
    assert fingerprint("FC") == "fc"


@pytest.mark.parametrize(
    "raw, canonical",
    [
        ("Man United", "Manchester United"),
        ("Man Utd", "Manchester United"),
        ("manchester utd", "Manchester United"),
        ("Man City", "Manchester City"),
        ("Spurs", "Tottenham Hotspur"),
        ("Tottenham", "Tottenham Hotspur"),
        ("Wolves", "Wolverhampton Wanderers"),
        ("Nott'm Forest", "Nottingham Forest"),
        ("Brighton", "Brighton & Hove Albion"),
        ("Sheffield United", "Sheffield United"),
        ("Liverpool FC", "Liverpool"),
    ],
)
def test_project_aliases(raw, canonical):
    assert default_normaliser().normalise(raw) == canonical


def test_normalisation_is_idempotent():
    """Canonical names must map to themselves, or repeated loads would drift."""
    normaliser = default_normaliser()
    for name in normaliser.canonical_names:
        assert normaliser.normalise(name) == name


def test_unknown_name_raises_with_suggestion():
    normaliser = default_normaliser()
    with pytest.raises(UnknownTeamError) as excinfo:
        normaliser.normalise("Manchester Rovers")
    message = str(excinfo.value)
    assert "team_aliases.yaml" in message
    assert "Manchester" in message  # a close match is suggested


def test_ambiguous_alias_is_rejected_at_build_time():
    with pytest.raises(ValueError, match="ambiguous"):
        TeamNameNormaliser({"Leeds United": ["Leeds"], "Leeds City": ["Leeds"]})


def test_normalise_series_reports_all_unknowns_at_once():
    normaliser = TeamNameNormaliser({"Arsenal": [], "Chelsea": []})
    values = pd.Series(["Arsenal", "Fulham", "Chelsea", "Reading"])
    with pytest.raises(UnknownTeamError) as excinfo:
        normaliser.normalise_series(values)
    assert "Fulham" in str(excinfo.value) and "Reading" in str(excinfo.value)

    # Non-strict mode passes unknowns through, for the `data check` report.
    relaxed = normaliser.normalise_series(values, strict=False)
    assert list(relaxed) == ["Arsenal", "Fulham", "Chelsea", "Reading"]
    assert normaliser.unknown(values) == ["Fulham", "Reading"]
