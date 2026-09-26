# Runbook

_Operational procedures for CivicPulse._

## Deploy (Docker Compose)

```bash
cp .env.example .env   # fill GROQ_API_KEY and POSTGRES_PASSWORD
docker compose up --build -d
docker compose exec backend alembic upgrade head
docker compose exec backend python scripts/seed.py
```

## Deploy (Kubernetes)

```bash
# Always deploy by commit SHA — never :latest
export SHA=$(git rev-parse HEAD)
cd k8s/overlays/prod
kustomize edit set image \
  backend=ghcr.io/writtenbyali/civicpulse/backend:$SHA \
  frontend=ghcr.io/writtenbyali/civicpulse/frontend:$SHA
kubectl apply -k .
kubectl rollout status deployment/backend -n civicpulse
kubectl rollout status deployment/frontend -n civicpulse
```

## Rollback

Two mechanisms. Use the right one for the moment.

### Mechanism 1 — Imperative rollback (the 3 a.m. answer)

```bash
kubectl rollout undo deployment/backend -n civicpulse
kubectl rollout undo deployment/frontend -n civicpulse
kubectl rollout status deployment/backend -n civicpulse
```

**When to use:** Production is on fire right now. A bad deploy is causing errors or crashes and you need to stop the bleeding in under 30 seconds. Kubernetes switches to the previous ReplicaSet immediately. No git history, no PR, no review — just speed.

**Drawback:** "What is production running?" no longer has a one-word answer. The cluster and the git overlay are now out of sync. You must follow up with Mechanism 2 once the incident is over.

---

### Mechanism 2 — Declarative rollback (the correct answer once the fire is out)

```bash
# Find the last known-good SHA from git log or the GitHub Actions run
GOOD_SHA=<previous-commit-sha>

cd k8s/overlays/prod
kustomize edit set image \
  backend=ghcr.io/writtenbyali/civicpulse/backend:$GOOD_SHA \
  frontend=ghcr.io/writtenbyali/civicpulse/frontend:$GOOD_SHA

# Commit and push — this goes through the normal PR → CI → merge → CD pipeline
git add kustomization.yaml
git commit -m "revert: roll back to $GOOD_SHA after incident"
git push origin dev
# Open PR to main → CI passes → CD redeploys with the known-good SHA
```

**When to use:** After the immediate incident is resolved (or as the first step when you have time). This is auditable — the rollback appears in git history, the SHA is traceable with `git show`, and the CI gate verifies the known-good build before it reaches production. This is the answer the on-call handoff report should reference.

**When NOT to use Mechanism 1 alone:** If you only do the imperative rollback and never follow up with the declarative one, the overlay file still points to the broken SHA. The next CD run will redeploy the broken version.

---

## Reading structured logs

```bash
# Docker Compose
docker compose logs backend --follow | jq .

# Kubernetes
kubectl logs -l app=backend -n civicpulse --follow | jq .
```

Every log line carries `request_id` (from `X-Request-ID` header), `level`, `timestamp` and `message`. Filter for triage fallbacks:

```bash
kubectl logs -l app=backend -n civicpulse | jq 'select(.level=="WARNING")'
```

## Network policy debugging

If pods cannot reach each other after applying the k8s manifests, the NetworkPolicy deny-all
default is the first suspect.

```bash
# Verify policies are applied
kubectl get networkpolicy -n civicpulse

# Test backend → postgres connectivity from inside backend pod
kubectl exec -n civicpulse deploy/backend -- \
  python -c "import socket; socket.connect(('postgres', 5432)); print('OK')"

# Temporarily allow all traffic for debugging (revert before merging)
kubectl delete networkpolicy deny-all-default -n civicpulse
```

DNS (UDP 53) and HTTPS (TCP 443) egress are explicitly allowed for backend so Groq/Resend
API calls and Nominatim geocoding from the frontend work without extra policy rules.

---

## When triage starts failing

1. Check `/api/meta/providers` — look at the last 20 outcomes for `fallback: true` rate
2. Check `/metrics` for `civicpulse_triage_fallbacks_total` counter by provider
3. Check logs for WARNING entries — they include `provider` and `error_class`
4. If Groq is rate-limited: system falls back to `RuleBasedTriage` automatically; no action needed
5. If sustained fallback rate (> 50% over 10 min): switch provider without redeploying:
   ```bash
   kubectl set env deployment/backend TRIAGE_PROVIDER=rules -n civicpulse
   ```
6. Monitor `/api/meta/providers` until LLM recovers, then switch back
