"""The nightly run's two safety nets around publishing (hardening F-17 and F-04).

The raw-download record (pipeline.raw_manifest): cached files are trusted only
if they match it, and it only ever grows. The publish checks
(scripts/check_publish.sh): the update job's commit is pushed only if it is one
commit on the starting point, touches allowed paths, and keeps history, the
lock log and the raw record append-only. The script is run for real with bash
and git against a local repository standing in for GitHub. Offline.
"""

from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
from pathlib import Path

import pytest

from tabletalk.pipeline import raw_manifest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "check_publish.sh"


# ---------------------------------------------------------------------------
# The raw-download record
# ---------------------------------------------------------------------------


def _write(path: Path, text: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(text.encode("utf-8"))  # exact bytes: no CRLF on Windows
    return path


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@pytest.fixture
def raw(tmp_path, monkeypatch):
    raw_dir = tmp_path / "raw"
    _write(raw_dir / "football_data_uk" / "E0_2425.csv", "old season\n")
    _write(raw_dir / "football_data_uk" / "E0_2627.csv", "this season, so far\n")
    monkeypatch.setattr(raw_manifest, "current_season_files",
                        lambda raw_dir, competitions=None: {"football_data_uk/E0_2627.csv"})
    return raw_dir


def test_with_no_record_the_whole_cache_is_cleared(raw, tmp_path):
    prepared = raw_manifest.prepare(tmp_path / "state" / "raw_manifest.sha256", raw)
    assert prepared.cold
    assert prepared.deleted == ["football_data_uk/E0_2425.csv", "football_data_uk/E0_2627.csv"]
    assert not any(raw.rglob("*.csv"))


def test_only_files_matching_the_record_are_kept(raw, tmp_path):
    manifest = _write(tmp_path / "raw_manifest.sha256", f"{_sha('old season\n')}  football_data_uk/E0_2425.csv\n")
    _write(raw / "football_data_uk" / "E0_2324.csv", "slipped into the cache\n")
    prepared = raw_manifest.prepare(manifest, raw)
    assert prepared.kept == 1 and not prepared.cold
    assert prepared.deleted == ["football_data_uk/E0_2324.csv", "football_data_uk/E0_2627.csv"]
    (raw / "football_data_uk" / "E0_2425.csv").write_text("an old result, changed\n", encoding="utf-8")
    assert raw_manifest.prepare(manifest, raw).deleted == ["football_data_uk/E0_2425.csv"]


def test_the_record_adds_past_seasons_skips_the_current_one_and_never_changes_a_line(raw, tmp_path):
    manifest = tmp_path / "state" / "raw_manifest.sha256"
    added, problems = raw_manifest.record(manifest, raw)
    assert added == ["football_data_uk/E0_2425.csv"] and problems == []
    first = manifest.read_text(encoding="utf-8")
    assert first == f"{_sha('old season\n')}  football_data_uk/E0_2425.csv\n"

    (raw / "football_data_uk" / "E0_2425.csv").write_text("the source rewrote it\n", encoding="utf-8")
    _write(raw / "football_data_uk" / "E0_2526.csv", "last season\n")
    added, problems = raw_manifest.record(manifest, raw)
    assert added == ["football_data_uk/E0_2526.csv"]
    assert len(problems) == 1 and problems[0].startswith("football_data_uk/E0_2425.csv was downloaded again")
    assert manifest.read_text(encoding="utf-8").startswith(first)  # the original line stays


def test_a_malformed_record_is_an_error(tmp_path):
    manifest = _write(tmp_path / "raw_manifest.sha256", "not a record line\n")
    with pytest.raises(ValueError, match="line 1"):
        raw_manifest.read(manifest)


def test_the_current_season_files_are_the_ones_each_run_downloads_again():
    from tabletalk.paths import RAW_DATA_DIR

    current = raw_manifest.current_season_files(RAW_DATA_DIR, ["premier_league"])
    assert "football_data_org/PL_2026-27.json" in current
    assert "football_data_uk/E0_2627.csv" in current
    assert "football_data_uk/E0_2526.csv" not in current


# ---------------------------------------------------------------------------
# The publish checks, run for real
# ---------------------------------------------------------------------------


def _bash() -> str | None:
    """Git's bash (on Windows, not WSL's bash.exe, which cannot see these paths)."""
    if os.name != "nt":
        return shutil.which("bash")
    git = shutil.which("git")
    if not git:
        return None
    # git.exe is in <Git>\cmd or <Git>\mingw64\bin; bash is <Git>\bin\bash.exe.
    for folder in Path(git).resolve().parents:
        if (folder / "bin" / "bash.exe").exists() and (folder / "usr").is_dir():
            return str(folder / "bin" / "bash.exe")
    return None


BASH = _bash()
pytestmark_script = pytest.mark.skipif(BASH is None, reason="bash and git are needed to run the publish checks")

GIT_ENV = {
    "GIT_AUTHOR_NAME": "test", "GIT_AUTHOR_EMAIL": "test@example.com",
    "GIT_COMMITTER_NAME": "test", "GIT_COMMITTER_EMAIL": "test@example.com",
    "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1",
}


def _git(cwd: Path, *args: str) -> str:
    result = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True,
                            env={**os.environ, **GIT_ENV}, check=True)
    return result.stdout.strip()


LOCK_1 = '{"event":"lock","lock_id":"fdorg:1#1","prev":"' + "0" * 64 + '"}\n'
LOCK_2 = '{"event":"lock","lock_id":"fdorg:2#1","prev":"aaaa"}\n'
MANIFEST = f"{'1' * 64}  football_data_uk/E0_2425.csv\n"


@pytest.fixture
def published(tmp_path):
    """A stand-in for GitHub (a bare repository with a `data` branch), and a clone to make the next commit in."""
    remote, work = tmp_path / "remote.git", tmp_path / "work"
    _git(tmp_path, "init", "--quiet", "--bare", str(remote))
    _git(tmp_path, "init", "--quiet", "-b", "data", str(work))
    for name, text in {
        "README.md": "# data\n", "latest/index.json": "{}\n", "history/2026-10-19T0646Z/index.json": "{}\n",
        "track_record/locks.jsonl": LOCK_1, "state/raw_manifest.sha256": MANIFEST,
    }.items():
        _write(work / name, text)
    _git(work, "add", "-A")
    _git(work, "commit", "--quiet", "-m", "base")
    _git(work, "push", "--quiet", str(remote), "data")
    return remote, work, _git(work, "rev-parse", "HEAD")


def _publish(remote: Path, work: Path, base: str, *, bundle_from: str | None = None) -> subprocess.CompletedProcess:
    """Commit what is in `work`, bundle it as the update job does, and run the publish checks."""
    _git(work, "add", "-A")
    _git(work, "commit", "--quiet", "--allow-empty", "-m", "nightly")
    bundle = work.parent / "data.bundle"
    _git(work, "bundle", "create", "--quiet", str(bundle), "HEAD", f"^{bundle_from or base}")
    env = {**os.environ, **GIT_ENV, "BASE": base, "DATA_REMOTE": remote.as_posix()}
    env.pop("GH_TOKEN", None)
    return subprocess.run([BASH, SCRIPT.as_posix(), bundle.as_posix()], capture_output=True, text=True, env=env)


def _tip(remote: Path) -> str:
    return _git(remote, "rev-parse", "data")


@pytestmark_script
def test_a_normal_nightly_commit_is_pushed(published):
    remote, work, base = published
    _write(work / "latest" / "index.json", '{"new": true}\n')
    _write(work / "history" / "2026-10-20T0850Z" / "index.json", "{}\n")
    _write(work / "track_record" / "locks.jsonl", LOCK_1 + LOCK_2)
    _write(work / "state" / "raw_manifest.sha256", MANIFEST + f"{'2' * 64}  football_data_uk/E0_2526.csv\n")
    result = _publish(remote, work, base)
    assert result.returncode == 0, result.stdout + result.stderr
    assert _tip(remote) == _git(work, "rev-parse", "HEAD")


@pytest.mark.parametrize(
    ("change", "reason"),
    [
        (lambda w: _write(w / "track_record" / "locks.jsonl", LOCK_1.replace("fdorg:1", "fdorg:9") + LOCK_2),
         "old lines were changed"),
        (lambda w: _write(w / "state" / "raw_manifest.sha256", f"{'3' * 64}  football_data_uk/E0_2425.csv\n"),
         "recorded lines were changed or removed"),
        (lambda w: _write(w / "history" / "2026-10-19T0646Z" / "index.json", '{"rewritten": true}\n'),
         "an existing history file was changed"),
        (lambda w: (w / "latest" / "index.json").unlink(), "deleted"),
        (lambda w: _write(w / ".github" / "workflows" / "evil.yml", "on: push\n"), "outside latest/"),
    ],
    ids=["edited-lock-line", "changed-raw-record", "edited-history", "deleted-file", "path-outside"],
)
@pytestmark_script
def test_a_bad_commit_is_refused_and_nothing_is_pushed(published, change, reason):
    remote, work, base = published
    change(work)
    result = _publish(remote, work, base)
    assert result.returncode != 0
    assert reason in result.stdout
    assert _tip(remote) == base


@pytestmark_script
def test_a_branch_that_moved_meanwhile_is_refused(published, tmp_path):
    remote, work, base = published
    other = tmp_path / "other"
    _git(tmp_path, "clone", "--quiet", "--branch", "data", str(remote), str(other))
    _write(other / "latest" / "index.json", '{"another run": true}\n')
    _git(other, "commit", "--quiet", "-am", "another run")
    _git(other, "push", "--quiet", "origin", "data")
    moved = _tip(remote)
    _write(work / "latest" / "index.json", '{"new": true}\n')
    result = _publish(remote, work, base)
    assert result.returncode != 0 and "moved since the update started" in result.stdout
    assert _tip(remote) == moved


@pytestmark_script
def test_more_than_one_new_commit_is_refused(published):
    remote, work, base = published
    _write(work / "latest" / "index.json", '{"first": true}\n')
    _git(work, "commit", "--quiet", "-am", "first")
    _write(work / "latest" / "index.json", '{"second": true}\n')
    result = _publish(remote, work, base)
    assert result.returncode != 0 and "parent is not" in result.stdout
    assert _tip(remote) == base
