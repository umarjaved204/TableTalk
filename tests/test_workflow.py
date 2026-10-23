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


def test_only_publish_can_write_contents_and_only_the_redeploy_path_can_start_workflows():
    # actions: write is needed by site.yml's redeploy job, so its two callers must allow it too.
    may_start_workflows = {(SITE, "redeploy"), (DAILY, "site"), (DEPLOY_SITE, "site")}
    for path in WORKFLOWS:
        for name, job in _load(path)["jobs"].items():
            for scope, access in (job.get("permissions") or {}).items():
                if access != "write":
                    continue
                allowed = (scope, path, name) == ("contents", DAILY, "publish") or (
                    scope == "actions" and (path, name) in may_start_workflows
                )
                assert allowed, f"{path.name} {name}: {scope}: write"


def test_the_nightly_run_deploys_the_site_after_a_successful_publish():
    workflow = _load(DAILY)
    site = workflow["jobs"]["site"]
    assert site["uses"] == "./.github/workflows/site.yml"
    assert site["needs"] == "publish"
    assert "!cancelled()" in site["if"] and "needs.publish.result == 'success'" in site["if"]
    assert site["permissions"] == {"contents": "read", "actions": "write"}
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
    assert workflow["jobs"]["site"]["permissions"] == {"contents": "read", "actions": "write"}


def test_the_build_job_verifies_the_tip_of_main_and_never_sees_the_token():
    workflow = _load(SITE)
    assert "workflow_call" in _triggers(workflow)
    assert workflow["permissions"] == {}
    assert workflow["env"]["SITE_URL"] == "https://tabletalk.fyi"
    build = workflow["jobs"]["build-site"]
    assert build["permissions"] == {"contents": "read"}
    assert "secrets." not in yaml.safe_dump(build) and "environment" not in build
    # The tip of main, never the commit the (possibly hours-old) run started on.
    checkout = next(step for step in build["steps"] if "actions/checkout@" in step.get("uses", ""))
    assert checkout["with"]["ref"] == "main"
    assert build["outputs"] == {
        "main_sha": "${{ steps.commits.outputs.main_sha }}",
        "data_sha": "${{ steps.commits.outputs.data_sha }}",
    }
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
    # The first step only learns whether the token exists, and whether the build is still the
    # tip of main and data; every later step runs only if both hold.
    gate = steps[0]
    assert gate["id"] == "gate"
    assert gate["env"]["HAS_TOKEN"] == "${{ secrets.CLOUDFLARE_API_TOKEN != '' }}"
    assert gate["env"]["BUILT_MAIN"] == "${{ needs.build-site.outputs.main_sha }}"
    assert gate["env"]["BUILT_DATA"] == "${{ needs.build-site.outputs.data_sha }}"
    assert "::notice::" in gate["run"] and "exit 0" in gate["run"]
    assert "git ls-remote" in gate["run"] and 'echo "stale=true"' in gate["run"]
    assert deploy["outputs"] == {"stale": "${{ steps.gate.outputs.stale }}"}
    assert all(step.get("if") == "steps.gate.outputs.go == 'true'" for step in steps[1:])
    # deploy/ is fetched at the commit that was built.
    fetch = next(step for step in steps if "git init" in step.get("run", ""))
    assert fetch["env"]["SHA"] == "${{ needs.build-site.outputs.main_sha }}"
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


def test_every_deploy_ends_with_the_go_live_check_on_the_live_site():
    steps = _load(SITE)["jobs"]["deploy"]["steps"]
    deployed = next(i for i, step in enumerate(steps) if "wrangler deploy" in step.get("run", ""))
    wait, check = steps[-2], steps[-1]
    assert steps.index(wait) > deployed
    # Waits until the live home page is the one just built, then fails if it never is.
    assert '"$SITE_URL/"' in wait["run"] and "cmp -s - dist/index.html" in wait["run"]
    assert "exit 1" in wait["run"]
    # The check itself: curl only, no secrets, and nothing that could hide a failure. It is
    # tried again while a deploy is still spreading, but the last failure fails the step.
    assert 'bash check-live.sh "$SITE_URL"' in check["run"]
    assert "for attempt in 1 2 3 4" in check["run"] and "sleep 30" in check["run"]
    assert check["run"].rstrip().endswith("exit 1")
    assert check["working-directory"] == "src/deploy"
    for step in (wait, check):
        assert "env" not in step and "continue-on-error" not in step
    assert _load(SITE)["env"]["SITE_URL"] == "https://tabletalk.fyi"


def test_both_callers_pass_the_cloudflare_token_by_name_and_nothing_else():
    # A reusable workflow sees only the secrets its caller passes, even environment secrets:
    # without this the token is an empty string and the deploy silently skips (22 Oct 2026).
    declared = _triggers(_load(SITE))["workflow_call"]["secrets"]
    assert list(declared) == ["CLOUDFLARE_API_TOKEN"]
    for path in (DAILY, DEPLOY_SITE):
        site = _load(path)["jobs"]["site"]
        assert site["secrets"] == {"CLOUDFLARE_API_TOKEN": TOKEN}, path.name  # never `inherit`


def test_an_out_of_date_deploy_starts_deploy_site_on_main_without_secrets():
    redeploy = _load(SITE)["jobs"]["redeploy"]
    assert redeploy["needs"] == "deploy"
    assert redeploy["if"] == "${{ needs.deploy.outputs.stale == 'true' }}"
    assert redeploy["permissions"] == {"actions": "write"}
    assert "environment" not in redeploy and "secrets." not in yaml.safe_dump(redeploy)
    (step,) = redeploy["steps"]
    assert step["run"] == 'gh workflow run deploy-site.yml --repo "$REPO" --ref main'
    assert step["env"]["GH_TOKEN"] == "${{ github.token }}"


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
