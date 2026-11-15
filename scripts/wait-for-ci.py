#!/usr/bin/env python3
"""Wait for a passing CI run on a tagged commit, or report that CI has not run.

The Release workflow uses this script as the quality gate. It does not publish
a release. The exit status and the ci_result output are:

- exit 0, ci_result=passed: this commit already has a successful CI run
- exit 0, ci_result=missing: no CI run appeared within the grace period, so
  the workflow should run the equivalent checks itself
- exit 1, ci_result=failed: CI finished unsuccessfully, or waiting reached
  the timeout while a run was still in progress
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from typing import Any

ACTIVE_STATUSES = frozenset(
    {"queued", "in_progress", "waiting", "requested", "pending"}
)
FAILED_CONCLUSIONS = frozenset(
    {"failure", "timed_out", "startup_failure", "action_required", "stale"}
)
RUN_FIELDS = ",".join(
    [
        "databaseId",
        "status",
        "conclusion",
        "event",
        "headSha",
        "url",
        "createdAt",
        "startedAt",
        "name",
        "workflowName",
    ]
)


def run_gh(args: list[str], *, capture: bool = True) -> subprocess.CompletedProcess[str]:
    command = ["gh", *args]
    return subprocess.run(command, check=True, text=True, capture_output=capture)


def resolve_sha(repo: str, ref: str) -> str:
    result = run_gh(["api", f"repos/{repo}/commits/{ref}", "--jq", ".sha"])
    sha = result.stdout.strip()
    if not sha:
        raise SystemExit(f"Could not resolve {ref!r} to a commit in {repo}.")
    return sha


def list_runs(repo: str, sha: str, workflow: str) -> list[dict[str, Any]]:
    result = run_gh(
        [
            "run",
            "list",
            "--repo",
            repo,
            "--commit",
            sha,
            "--workflow",
            workflow,
            "--json",
            RUN_FIELDS,
            "--limit",
            "50",
        ]
    )
    runs = json.loads(result.stdout or "[]")
    if not isinstance(runs, list):
        raise SystemExit("gh run list returned an unexpected payload.")
    return [run for run in runs if run.get("headSha") == sha]


def classify(runs: list[dict[str, Any]]) -> tuple[str, list[dict[str, Any]]]:
    """Return passed, failed, active, or none, plus any runs to wait on."""
    successful = [run for run in runs if run.get("conclusion") == "success"]
    if successful:
        return "passed", successful
    active = [run for run in runs if run.get("status") in ACTIVE_STATUSES]
    if active:
        return "active", active
    failed = [run for run in runs if run.get("conclusion") in FAILED_CONCLUSIONS]
    if failed:
        return "failed", failed
    return "none", []


def pick_watch_target(runs: list[dict[str, Any]]) -> dict[str, Any]:
    def sort_key(run: dict[str, Any]) -> tuple[int, str, int]:
        event_rank = 0 if run.get("event") == "push" else 1
        started = str(run.get("startedAt") or run.get("createdAt") or "")
        return event_rank, started, int(run.get("databaseId") or 0)

    return sorted(runs, key=sort_key)[0]


def write_output(name: str, value: str) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(f"{name}={value}\n")
    print(f"{name}={value}")


def describe_run(run: dict[str, Any]) -> str:
    run_id = run.get("databaseId")
    status = run.get("status")
    conclusion = run.get("conclusion") or "none"
    url = run.get("url") or ""
    event = run.get("event") or "unknown"
    return f"run {run_id} ({event}, {status}, {conclusion}) {url}".strip()


def watch_run(repo: str, run: dict[str, Any]) -> None:
    run_id = str(run["databaseId"])
    print(f"Waiting for {describe_run(run)}.", flush=True)
    subprocess.run(
        ["gh", "run", "watch", run_id, "--repo", repo, "--interval", "10"],
        check=False,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", help="Git tag or other ref to resolve to a commit.")
    parser.add_argument("--sha", help="Commit SHA to check. Overrides --tag if both are set.")
    parser.add_argument(
        "--repo",
        default=os.environ.get("GITHUB_REPOSITORY", ""),
        help="owner/name repository. Defaults to GITHUB_REPOSITORY.",
    )
    parser.add_argument(
        "--workflow",
        default="ci.yml",
        help="CI workflow file name or workflow name. Defaults to ci.yml.",
    )
    parser.add_argument(
        "--grace-seconds",
        type=int,
        default=120,
        help="How long to wait for a CI run to appear before reporting missing.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=2700,
        help="Maximum time to wait for an in-progress CI run.",
    )
    args = parser.parse_args(argv)

    if args.grace_seconds < 0 or args.timeout_seconds < 0:
        raise SystemExit("Grace and timeout values must be zero or positive.")
    if not args.repo:
        raise SystemExit("Pass --repo or set GITHUB_REPOSITORY.")
    if not args.tag and not args.sha:
        raise SystemExit("Pass --tag or --sha.")

    sha = args.sha or resolve_sha(args.repo, args.tag)
    print(f"Checking CI for {sha} in {args.repo} (workflow {args.workflow}).", flush=True)

    started = time.monotonic()
    deadline = started + args.timeout_seconds
    grace_until = started + args.grace_seconds

    while True:
        now = time.monotonic()
        if now > deadline:
            write_output("ci_result", "failed")
            raise SystemExit(
                f"Timed out after {args.timeout_seconds} seconds waiting for CI on {sha}."
            )

        runs = list_runs(args.repo, sha, args.workflow)
        state, matched = classify(runs)
        if state == "passed":
            print(f"CI already passed: {describe_run(matched[0])}.", flush=True)
            write_output("ci_result", "passed")
            return 0
        if state == "failed":
            print(f"CI failed: {describe_run(matched[0])}.", flush=True)
            write_output("ci_result", "failed")
            return 1
        if state == "active":
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                continue
            watch_run(args.repo, pick_watch_target(matched))
            continue

        if time.monotonic() < grace_until:
            sleep_for = min(15, grace_until - time.monotonic())
            if sleep_for > 0:
                print(
                    f"No CI run for {sha} yet; waiting {sleep_for:.0f}s "
                    "for one to appear.",
                    flush=True,
                )
                time.sleep(sleep_for)
            continue

        print(
            f"No CI run for {sha} within {args.grace_seconds} seconds. "
            "The release workflow should run the equivalent checks.",
            flush=True,
        )
        write_output("ci_result", "missing")
        return 0


if __name__ == "__main__":
    sys.exit(main())
