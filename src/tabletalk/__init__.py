"""TableTalk: football competition probability model.

Three independent layers, so that adding a competition does not mean
rewriting the core:

1. ``tabletalk.model``      - the match model (Dixon-Coles). Knows about two
                              teams and a venue; knows nothing about tables.
2. ``tabletalk.simulation`` - competition simulators that call the match model
                              thousands of times (league tables, knockout ties).
3. ``configs/``             - one file per competition describing its rules.

``tabletalk.data`` sits underneath all three and produces one standard
match dataframe regardless of where the results came from.
"""

__version__ = "0.1.0"
