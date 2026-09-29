# TableTalk data

Written by the nightly GitHub Actions run (`python -m tabletalk update`), never by hand.

- `latest/` - the newest snapshot for each league, and `index.json` saying what the last run did
- `history/` - every run's files, never changed afterwards
- `track_record/locks.jsonl` - predictions locked before kick-off (append-only, hash-chained)
- `track_record/summary.json` - locked predictions scored against results

What every field means: `contracts/README.md` on the `main` branch.
Each commit on this branch is one nightly run. The branch is protected against
force-pushes and deletion, so its commit history is strong evidence (not proof) of when
every prediction was published. The hash chain in `locks.jsonl` shows the log was not edited.
