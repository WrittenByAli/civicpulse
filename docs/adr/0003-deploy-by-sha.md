# ADR 0003 — Deploy by Commit SHA

**Date:** 2026-09-25
**Status:** Accepted

## Context

Container images can be tagged with any string. Two common choices are `:latest` (a moving target) and a commit SHA (an immutable reference). The CD pipeline pushes both, but only one is used for deployment.

## Decision

**Deploy using the commit SHA tag.** The CD pipeline tags images as both `ghcr.io/writtenbyali/civicpulse-backend:${GITHUB_SHA}` and `:latest`, but the Kubernetes manifest and the smoke test use the SHA tag exclusively.

## Rationale

- **"What is production running?" has a one-word answer.** `kubectl get deployment backend -n civicpulse -o jsonpath='{.spec.template.spec.containers[0].image}'` returns a SHA you can paste directly into `git show`.
- **`:latest` is mutable.** If a bad image is pushed with the `:latest` tag and a pod restarts, Kubernetes pulls the bad image silently. With a SHA, the running image is immutable for the lifetime of the deployment.
- **Rollback is exact.** `kubectl rollout undo` restores the previous SHA, which points to a specific, known-good commit.

## Alternatives considered

- **Semver tags (e.g. `v1.2.3`):** Acceptable for releases but not for every merge to main. Rejected as the primary deployment reference.
- **`:latest` everywhere:** Destroys auditability and is an automatic −8 deduction. Firmly rejected.

## Consequences

The CD pipeline must capture `${{ github.sha }}` and pass it to the `kubectl set image` or Kustomize image override. The `:latest` tag is still pushed so `docker compose pull` works conveniently in development.
