"""The nightly workflow's hardening rules, so a later edit cannot quietly undo them.

F-04: no permissions by default; only the publish job can write, and it never
sees the API key; no checkout keeps credentials. F-05: every action pinned to a
full commit SHA with its version in a comment. F-15: no `${{ }}` inside a
`run:` script (values reach the shell through `env:`). The website deploy
(site.yml): the job that builds never holds the Cloudflare token, the job with
the token builds nothing and skips cleanly until the token exists, and
Wrangler is installed at one exact version with install scripts off. Offline.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = sorted((ROOT / ".github" / "workflows").glob("*.yml"))
DAILY = ROOT / ".github" / "workflows" / "daily-update.yml"
SITE = ROOT / ".github" / "workflows" / "site.yml"
DEPLOY_SITE = ROOT / ".github" / "workflows" / "deploy-site.yml"
DEPLOY = ROOT / "deploy"
TOKEN = "${{ secrets.CLOUDFLARE_API_TOKEN }}"


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


def _triggers(workflow: dict) -> dict:
    # PyYAML reads the key `on` as True.
    return workflow.get("on", workflow.get(True))


def test_only_github_owned_actions_are_used():
    # The repository allows GitHub-owned actions only (so never cloudflare/wrangler-action).
    for path in WORKFLOWS:
        for job, step in _steps(_load(path)):
            uses = step.get("uses", "")
            assert not uses or uses.startswith("actions/"), f"{path.name} {job}: {uses}"


def test_no_job_except_publish_can_write():
    for path in WORKFLOWS:
        for name, job in _load(path)["jobs"].items():
            if (path, name) == (DAILY, "publish"):
                continue
            assert "write" not in yaml.safe_dump(job.get("permissions", {})), f"{path.name} {name}"


def test_the_nightly_run_deploys_the_site_after_a_successful_publish():
    workflow = _load(DAILY)
    site = workflow["jobs"]["site"]
    assert site["uses"] == "./.github/workflows/site.yml"
    assert site["needs"] == "publish"
    assert "!cancelled()" in site["if"] and "needs.publish.result == 'success'" in site["if"]
    assert site["permissions"] == {"contents": "read"}
    assert site["with"]["data_ref"] == "${{ needs.publish.outputs.data_sha }}"
    publish = workflow["jobs"]["publish"]
    assert publish["outputs"]["data_sha"] == "${{ steps.push.outputs.data_sha }}"
    assert 'echo "data_sha=$new" >> "$GITHUB_OUTPUT"' in (ROOT / "scripts" / "check_publish.sh").read_text(encoding="utf-8")


def test_deploy_site_runs_on_website_changes_to_main_and_by_hand():
    workflow = _load(DEPLOY_SITE)
    triggers = _triggers(workflow)
    assert triggers["push"]["branches"] == ["main"]
    assert {"web/**", "deploy/**", ".github/workflows/site.yml"} <= set(triggers["push"]["paths"])
    assert "workflow_dispatch" in triggers
    assert workflow["permissions"] == {}
    assert workflow["jobs"]["site"]["uses"] == "./.github/workflows/site.yml"
    assert workflow["jobs"]["site"]["permissions"] == {"contents": "read"}


def test_the_build_job_verifies_the_site_and_never_sees_the_token():
    workflow = _load(SITE)
    assert "workflow_call" in _triggers(workflow)
    assert workflow["permissions"] == {}
    assert workflow["env"]["SITE_URL"] == "https://tabletalk.fyi"
    build = workflow["jobs"]["build-site"]
    assert build["permissions"] == {"contents": "read"}
    assert "secrets." not in yaml.safe_dump(build) and "environment" not in build
    runs = [step.get("run", "") for step in build["steps"]]
    assert "npm run verify" in runs
    assert any("upload-artifact" in step.get("uses", "") and step["with"]["path"] == "web/dist" for step in build["steps"])


def test_the_deploy_job_holds_the_token_builds_nothing_and_skips_without_it():
    deploy = _load(SITE)["jobs"]["deploy"]
    assert deploy["needs"] == "build-site"
    assert deploy["permissions"] == {}
    assert deploy["environment"] == "production"
    assert deploy["concurrency"] == {"group": "site-deploy", "cancel-in-progress": False}
    steps = deploy["steps"]
    # The first step only learns whether the token exists; every later step runs only if it does.
    assert steps[0]["id"] == "token"
    assert steps[0]["env"]["HAS_TOKEN"] == "${{ secrets.CLOUDFLARE_API_TOKEN != '' }}"
    assert "::notice::" in steps[0]["run"] and "exit 0" in steps[0]["run"]
    assert all(step.get("if") == "steps.token.outputs.ready == 'true'" for step in steps[1:])
    # The token's value reaches one step: the one that runs `wrangler deploy`, nothing else.
    with_token = [step for step in steps if TOKEN in step.get("env", {}).values()]
    assert len(with_token) == 1 and "wrangler deploy" in with_token[0]["run"]
    # No checkout (and so no credentials), no website build, no npm scripts.
    runs = "\n".join(step.get("run", "") for step in steps)
    assert not any("actions/checkout@" in step.get("uses", "") for step in steps)
    assert "npm ci --ignore-scripts" in runs
    assert not re.search(r"npm (run|install|i )|astro|verify", runs)
    # A real deploy failure fails the job.
    assert "continue-on-error" not in yaml.safe_dump(deploy)


def test_wrangler_is_pinned_to_one_exact_version_and_the_config_is_static_assets_only():
    package = json.loads((DEPLOY / "package.json").read_text(encoding="utf-8"))
    assert list(package["devDependencies"]) == ["wrangler"] and "dependencies" not in package
    version = package["devDependencies"]["wrangler"]
    assert re.fullmatch(r"\d+\.\d+\.\d+", version)
    lock = json.loads((DEPLOY / "package-lock.json").read_text(encoding="utf-8"))
    assert lock["packages"]["node_modules/wrangler"]["version"] == version
    assert (DEPLOY / ".nvmrc").read_text(encoding="utf-8") == (ROOT / "web" / ".nvmrc").read_text(encoding="utf-8")
    # wrangler.jsonc: whole-line // comments only, so dropping them leaves JSON.
    text = (DEPLOY / "wrangler.jsonc").read_text(encoding="utf-8")
    config = json.loads(re.sub(r"(?m)^\s*//.*$", "", text))
    assert "main" not in config  # no Worker code: static files only
    assert config["assets"]["directory"] == "./dist"
    assert config["assets"]["not_found_handling"] == "404-page"
    assert isinstance(config["workers_dev"], bool) and config["preview_urls"] is False
    for route in config.get("routes", []):
        assert route == {"pattern": "tabletalk.fyi", "custom_domain": True}
