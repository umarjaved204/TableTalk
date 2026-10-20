"""The nightly workflow's hardening rules, so a later edit cannot quietly undo them.

F-04: no permissions by default; only the publish job can write, and it never
sees the API key; no checkout keeps credentials. F-05: every action pinned to a
full commit SHA with its version in a comment. F-15: no `${{ }}` inside a
`run:` script (values reach the shell through `env:`). Offline.
"""

from __future__ import annotations

import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = sorted((ROOT / ".github" / "workflows").glob("*.yml"))
DAILY = ROOT / ".github" / "workflows" / "daily-update.yml"


def _load(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _steps(workflow: dict):
    for name, job in workflow["jobs"].items():
        for step in job.get("steps", []):
            yield name, step


def test_every_action_is_pinned_to_a_full_commit_sha_with_its_version():
    for path in WORKFLOWS:
        for line in path.read_text(encoding="utf-8").splitlines():
            match = re.match(r"\s*(?:-\s*)?uses:\s*(\S+)(.*)", line)
            if not match or match.group(1).startswith("./"):
                continue
            assert re.fullmatch(r"[\w.-]+/[\w./-]+@[0-9a-f]{40}", match.group(1)), f"{path.name}: {line.strip()}"
            assert re.fullmatch(r"\s+# v\d+\.\d+\.\d+", match.group(2)), f"{path.name}: no version comment: {line.strip()}"


def test_no_expression_is_pasted_into_a_shell_script():
    for path in WORKFLOWS:
        for job, step in _steps(_load(path)):
            assert "${{" not in step.get("run", ""), f"{path.name} {job}: {step.get('name')}"


def test_only_the_publish_job_can_write_and_it_never_sees_the_api_key():
    workflow = _load(DAILY)
    assert workflow["permissions"] == {}
    jobs = workflow["jobs"]
    assert jobs["update"]["permissions"] == {"contents": "read"}
    assert jobs["publish"]["permissions"] == {"contents": "write"}
    assert "secrets." not in yaml.safe_dump(jobs["publish"])
    assert "FOOTBALL_DATA_API_KEY" in yaml.safe_dump(jobs["update"])
    publish_steps = [step.get("uses", "") + step.get("run", "") for step in jobs["publish"]["steps"]]
    assert not any("setup-python" in s or "pip " in s or "tabletalk" in s for s in publish_steps)


def test_no_checkout_keeps_credentials():
    for path in WORKFLOWS:
        for job, step in _steps(_load(path)):
            if "actions/checkout@" in step.get("uses", ""):
                assert step.get("with", {}).get("persist-credentials") is False, f"{path.name} {job}"


def test_publish_runs_after_a_failed_update_but_not_after_a_cancelled_one():
    condition = _load(DAILY)["jobs"]["publish"]["if"]
    assert "!cancelled()" in condition and "needs.update.outputs.has_bundle == 'true'" in condition
