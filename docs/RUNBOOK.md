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
kubectl apply -k k8s/overlays/prod
kubectl rollout status deployment/backend -n civicpulse
kubectl rollout status deployment/frontend -n civicpulse
```

## Rollback

**Fast (imperative — use at 3 a.m.):**
```bash
kubectl rollout undo deployment/backend -n civicpulse
```

**Correct (declarative — use once the fire is out):**
```bash
# Edit overlays/prod/kustomization.yaml to point to the previous SHA
kubectl apply -k k8s/overlays/prod
```

Use the imperative rollback when speed matters and you need to stop the bleeding immediately. Use the declarative rollback to restore a known-good state in a way that is auditable, reviewable and reversible through the normal PR process.

## Reading structured logs

```bash
# Docker Compose
docker compose logs backend --follow | jq .

# Kubernetes
kubectl logs -l app=backend -n civicpulse --follow | jq .
```

Every log line includes `request_id` (from `X-Request-ID` header), `level`, `timestamp` and `message`. Filter for triage fallbacks:

```bash
kubectl logs -l app=backend -n civicpulse | jq 'select(.level=="WARNING" and .event=="triage_fallback")'
```

## When triage starts failing

1. Check `/api/meta/providers` — look at the last 20 outcomes for fallback rate
2. Check logs for `triage_fallback` WARNING entries — they include `provider` and `error_class`
3. If Groq is rate-limited: the system falls back to `RuleBasedTriage` automatically; no action needed
4. If fallback rate is sustained (>50% over 10 minutes): consider switching `TRIAGE_PROVIDER=rules` temporarily
5. To switch provider without redeploying (Kubernetes):
   ```bash
   kubectl set env deployment/backend TRIAGE_PROVIDER=rules -n civicpulse
   ```
6. Monitor `/api/meta/providers` until the LLM recovers, then switch back
