#!/usr/bin/env bash
# The nightly run's publish job: check the update job's new commit, then push it.
#
# The update job has the API key and runs pip and the model, but cannot push.
# It hands over one commit as a git bundle, plus the data-branch commit it
# started from (BASE). This job can push, but never sees the key and runs no
# project code: only this script and git. Before pushing it checks that the
# commit:
#
#   1. sits directly on BASE, and BASE is still the branch tip (one new commit,
#      fast-forward only; a run that raced another fails safe, and the next
#      try redoes the day);
#   2. only touches latest/, history/, track_record/, state/ and README.md;
#   3. deletes nothing, and only adds files under history/ (past runs are never
#      edited);
#   4. keeps the old lock log as an exact prefix of the new one (append-only);
#   5. keeps every line of the raw-download record (state/raw_manifest.sha256):
#      lines may be added, never changed or removed.
#
# What it cannot stop: a compromised update job appending a made-up lock line
# (the checks prove old lines are unchanged, not that new ones are honest).
#
# Usage: check_publish.sh <bundle>
# Environment: BASE (required), REPO (owner/name) or DATA_REMOTE (a URL or
# path; tests use a local repository), GH_TOKEN (push credentials; none for a
# local remote), DATA_BRANCH (default: data).
set -euo pipefail

bundle="$1"
: "${BASE:?BASE (the data commit the update started from) is required}"
branch="${DATA_BRANCH:-data}"
remote="${DATA_REMOTE:-https://github.com/${REPO:?REPO or DATA_REMOTE is required}.git}"

fail() { echo "::error::Publish refused: $*"; exit 1; }

work="$(mktemp -d)"
cd "$work"
git init --quiet
git fetch --quiet --depth=1 "$remote" "refs/heads/$branch"
tip="$(git rev-parse FETCH_HEAD)"
[ "$tip" = "$BASE" ] || fail "the $branch branch moved since the update started ($BASE -> $tip); the next try redoes the day"

git bundle verify --quiet "$bundle" || fail "the bundle does not apply to $BASE"
git fetch --quiet "$bundle" HEAD
new="$(git rev-parse FETCH_HEAD)"

# 1. One commit, directly on BASE.
[ "$(git rev-parse "$new^")" = "$BASE" ] || fail "the new commit's parent is not $BASE"
[ "$(git rev-list --count "$BASE..$new")" = "1" ] || fail "more than one new commit"

# 2 and 3. Which paths changed, and how.
while IFS=$'\t' read -r status path; do
  case "$path" in
    latest/*|track_record/*|state/*|README.md) ;;
    history/*) [ "$status" = "A" ] || fail "$path: an existing history file was changed ($status)" ;;
    *) fail "$path: outside latest/, history/, track_record/, state/ and README.md" ;;
  esac
  [ "$status" != "D" ] || fail "$path: deleted"
done < <(git diff --no-renames --name-status "$BASE" "$new")

# 4. The lock log only grows.
if git cat-file -e "$BASE:track_record/locks.jsonl" 2>/dev/null; then
  git show "$BASE:track_record/locks.jsonl" > old_locks
  git show "$new:track_record/locks.jsonl" > new_locks 2>/dev/null || fail "track_record/locks.jsonl was removed"
  size="$(wc -c < old_locks)"
  head -c "$size" new_locks | cmp --silent - old_locks || fail "track_record/locks.jsonl: old lines were changed"
fi

# 5. The raw-download record only grows.
if git cat-file -e "$BASE:state/raw_manifest.sha256" 2>/dev/null; then
  git show "$BASE:state/raw_manifest.sha256" | sort > old_manifest
  git show "$new:state/raw_manifest.sha256" 2>/dev/null | sort > new_manifest || fail "state/raw_manifest.sha256 was removed"
  lost="$(comm -23 old_manifest new_manifest)"
  [ -z "$lost" ] || fail "state/raw_manifest.sha256: recorded lines were changed or removed: $(echo "$lost" | head -3)"
fi

echo "Checks passed: one commit on $BASE, allowed paths only, history and lock log append-only, raw record add-only."

# Push: not forced, so GitHub refuses it too if the branch moved meanwhile.
if [ -n "${GH_TOKEN:-}" ]; then
  auth="$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 | tr -d '\n')"
  git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $auth" push --quiet "$remote" "$new:refs/heads/$branch"
else
  git push --quiet "$remote" "$new:refs/heads/$branch"
fi
echo "Published $new to $branch."
# For the site job (GitHub Actions only): the data commit to build from.
if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "data_sha=$new" >> "$GITHUB_OUTPUT"; fi
