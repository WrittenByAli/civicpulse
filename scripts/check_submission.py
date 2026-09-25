#!/usr/bin/env python3
"""
Submission lint script for CivicPulse (§5.8).
Catches the mechanical failures behind most automatic deductions.
A clean run does not guarantee a good mark; a dirty run nearly guarantees a bad one.
"""

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
ERRORS = []
WARNINGS = []


def check(condition: bool, error: str) -> None:
    if not condition:
        ERRORS.append(error)


def warn(condition: bool, warning: str) -> None:
    if not condition:
        WARNINGS.append(warning)


def git_grep(pattern: str) -> list[str]:
    try:
        result = subprocess.run(
            ["git", "grep", "-rn", "--", pattern],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip().splitlines() if result.stdout.strip() else []
    except Exception:
        return []


def run_checks() -> None:
    # --- .env not in git ---
    tracked = subprocess.run(
        ["git", "ls-files", ".env"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    ).stdout.strip()
    check(not tracked, "DEDUCTION -20: .env is tracked by git — remove it and rotate all credentials")

    # --- .env.example exists ---
    check((ROOT / ".env.example").exists(), "Missing .env.example")

    # --- No localhost in service-to-service config ---
    localhost_hits = git_grep("localhost")
    filtered = [h for h in localhost_hits if not any(x in h for x in ["test", "spec", "#", "README", "ADR", "check_submission"])]
    warn(not filtered, f"Possible localhost in service config: {filtered[:3]}")

    # --- compose.prod.yaml exists and has no 'build:' ---
    prod_compose = ROOT / "compose.prod.yaml"
    check(prod_compose.exists(), "Missing compose.prod.yaml")
    if prod_compose.exists():
        content = prod_compose.read_text()
        check("build:" not in content, "DEDUCTION: compose.prod.yaml contains 'build:' — production must use image: only")
        check("5432:" not in content and "6379:" not in content,
              "DEDUCTION -8: DB or cache port published in compose.prod.yaml")

    # --- Dockerfiles non-root ---
    for df in [ROOT / "backend" / "Dockerfile", ROOT / "frontend" / "Dockerfile"]:
        if df.exists():
            content = df.read_text()
            check("USER " in content, f"DEDUCTION -8: No non-root USER in {df.name}")
            check("CMD [" in content, f"Exec-form CMD missing in {df.name}")

    # --- K8s: no real secrets ---
    for secret_file in (ROOT / "k8s").rglob("secret*.yaml"):
        content = secret_file.read_text()
        # base64-encoded keys would be long strings; placeholder check
        warn("CHANGE_ME" in content or "placeholder" in content.lower(),
             f"K8s secret {secret_file} may contain real values — committed manifests must have placeholders only")

    # --- :latest not used in k8s manifests ---
    for yaml_file in (ROOT / "k8s").rglob("*.yaml"):
        content = yaml_file.read_text()
        if ":latest" in content:
            ERRORS.append(f"DEDUCTION -8: :latest tag found in {yaml_file.relative_to(ROOT)} — deploy by SHA")

    # --- GitHub workflows: needs: gate ---
    for wf in (ROOT / ".github" / "workflows").glob("*.yml"):
        content = wf.read_text()
        if ("push:" in content or "release" in wf.name) and "needs:" not in content:
            warn(False, f"Workflow {wf.name} may be missing 'needs:' gate on publish/deploy jobs")

    # --- README quickstart ---
    readme = ROOT / "README.md"
    check(readme.exists(), "DEDUCTION -5: README.md missing")
    if readme.exists():
        content = readme.read_text()
        check("docker compose up" in content, "DEDUCTION -5: README missing docker compose up quickstart")

    # --- Required docs ---
    for doc in [
        "docs/ENGINEERING-NOTES.md",
        "docs/RUNBOOK.md",
        "docs/AI-USAGE.md",
        "docs/adr/0001-provider-interface.md",
        "docs/adr/0002-frontend-runtime-config.md",
        "docs/adr/0003-deploy-by-sha.md",
        "docs/adr/0004-pii-and-data-governance.md",
    ]:
        check((ROOT / doc).exists(), f"Missing required doc: {doc}")


def main() -> None:
    print("CivicPulse submission lint\n" + "=" * 40)
    run_checks()

    if WARNINGS:
        print("\nWARNINGS:")
        for w in WARNINGS:
            print(f"  ⚠  {w}")

    if ERRORS:
        print("\nERRORS (fix before submitting):")
        for e in ERRORS:
            print(f"  ✗  {e}")
        print(f"\n{len(ERRORS)} error(s) found.")
        sys.exit(1)
    else:
        print("\n✓ All checks passed. Remember: a clean run does not guarantee a good mark.")


if __name__ == "__main__":
    main()
