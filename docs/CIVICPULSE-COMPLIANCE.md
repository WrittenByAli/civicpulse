# CivicPulse Assignment Compliance

## Requirements Checklist

| Requirement | Status | File(s) | Evidence |
|---|---|---|---|
| **Frontend** | | | |
| Complaint submission form | DONE | `frontend/src/pages/SubmitPage.tsx` | Form with text, location, contact fields |
| Loading state during triage | DONE | `frontend/src/pages/SubmitPage.tsx` | Dual spinner animation |
| Triage result display | DONE | `frontend/src/pages/SubmitPage.tsx` | Category, priority, summary, provider badge |
| Operations dashboard | DONE | `frontend/src/pages/DashboardPage.tsx` | Paginated complaint list |
| Category/priority/status filters | DONE | `frontend/src/pages/DashboardPage.tsx` | FilterSelect dropdowns |
| Status update from dashboard | DONE | `frontend/src/pages/DashboardPage.tsx` | Inline status transition buttons |
| 409 conflict error display | DONE | `frontend/src/pages/DashboardPage.tsx` | AnimatePresence error banner per card |
| Statistics page | DONE | `frontend/src/pages/StatsPage.tsx` | Category + priority breakdown |
| X-Cache HIT/MISS display | DONE | `frontend/src/pages/StatsPage.tsx` | Badge from response header |
| Error boundary | DONE | `frontend/src/components/ErrorBoundary.tsx` | React error boundary wrapper |
| Typed API client | DONE | `frontend/src/api/client.ts` | Typed fetch functions |
| No hardcoded API URL | DONE | `frontend/nginx.conf` | nginx /api proxy (ADR-001) |
| Frontend tests (≥5) | DONE | `frontend/tests/api.test.ts` | 6 Vitest tests |
| **Backend** | | | |
| FastAPI + Pydantic v2 | DONE | `backend/app/main.py` | FastAPI app |
| 4-layer architecture | DONE | `backend/app/routes/`, `services/`, `repositories/`, `providers/` | Clear separation |
| POST /api/complaints | DONE | `backend/app/routes/complaints.py` | 201 Created |
| GET /api/complaints/{id} | DONE | `backend/app/routes/complaints.py` | Single complaint |
| GET /api/complaints | DONE | `backend/app/routes/complaints.py` | List with pagination + filters |
| PATCH /api/complaints/{id}/status | DONE | `backend/app/routes/complaints.py` | 409 for invalid transitions |
| GET /api/stats | DONE | `backend/app/routes/stats.py` | Cached statistics |
| GET /api/meta/providers | DONE | `backend/app/routes/meta.py` | Active provider info |
| GET /health | DONE | `backend/app/routes/health.py` | No DB access |
| GET /ready | DONE | `backend/app/routes/health.py` | Checks postgres + redis |
| GET /metrics | DONE | `backend/app/main.py` | Prometheus via instrumentator |
| Status state machine (409) | DONE | `backend/app/services/state_machine.py` | Valid transition enforcement |
| Backend tests (≥65% coverage) | DONE | `backend/tests/` | 26 tests across 4 files |
| **Database** | | | |
| PostgreSQL 16 | DONE | `compose.yaml` | postgres:16-alpine |
| Alembic migrations | DONE | `backend/alembic/versions/0001_create_complaints.py` | Schema migration |
| UUID primary key | DONE | `backend/app/models.py` | UUID column |
| All required columns | DONE | `backend/app/models.py` | text, location, category, priority, status, ai_summary, triaged_by, triage_latency_ms, etc. |
| Indexes | DONE | `backend/alembic/versions/0001_create_complaints.py` | category, priority, status, created_at |
| Seed script (30+ complaints) | DONE | `scripts/seed.py` | 30 realistic Urdu-English complaints, idempotent |
| **AI Triage** | | | |
| Provider abstraction | DONE | `backend/app/providers/triage/base.py` | TriageProvider base class |
| LLMTriage (Groq) | DONE | `backend/app/providers/triage/llm.py` | Groq API integration |
| OllamaTriage | DONE | `backend/app/providers/triage/ollama.py` | Local Ollama |
| RuleBasedTriage | DONE | `backend/app/providers/triage/rules.py` | Keyword matching |
| SimulatedTriage | DONE | `backend/app/providers/triage/simulated.py` | Deterministic for CI |
| Env-based provider selection | DONE | `backend/app/providers/triage/factory.py` | TRIAGE_PROVIDER env var |
| Fallback to rules on failure | DONE | `backend/app/services/complaint_service.py` | triaged_by = "rules:fallback" |
| Retry with jitter | DONE | `backend/app/providers/triage/llm.py` | 1 retry, 10s timeout |
| Pydantic validation of AI output | DONE | `backend/app/providers/triage/base.py` | TriageResult model |
| triage_latency_ms recorded | DONE | `backend/app/services/complaint_service.py` | Timing wrapper |
| **Redis** | | | |
| Statistics cache (30s TTL) | DONE | `backend/app/routes/stats.py` | Read-through cache |
| X-Cache HIT/MISS header | DONE | `backend/app/routes/stats.py` | Response header |
| Cache invalidation on create | DONE | `backend/app/services/complaint_service.py` | Invalidates on new complaint |
| Rate limiter (Redis-based) | DONE | `backend/app/middleware.py` | IP-based, 429 + Retry-After |
| **Docker** | | | |
| Docker Compose | DONE | `compose.yaml` | 5 services |
| Multi-stage Dockerfiles | DONE | `backend/Dockerfile`, `frontend/Dockerfile` | Builder → runtime |
| Non-root containers | DONE | Both Dockerfiles | USER civicpulse |
| Healthchecks | DONE | `compose.yaml` | All services |
| .env.example committed | DONE | `.env.example` | Template with all vars |
| .env gitignored | DONE | `.gitignore` | .env excluded |
| PostgreSQL volume | DONE | `compose.yaml` | postgres_data volume |
| Redis volume | DONE | `compose.yaml` | redis_data volume |
| Network segmentation | DONE | `compose.yaml` | edge + internal networks |
| .dockerignore | DONE | `backend/.dockerignore` | Excludes tests, __pycache__ |
| **Kubernetes** | | | |
| Kustomize (base + overlays) | DONE | `k8s/base/`, `k8s/overlays/dev/`, `k8s/overlays/prod/` | Kustomize structure |
| civicpulse namespace | DONE | `k8s/base/namespace.yaml` | Namespace manifest |
| Frontend Deployment | DONE | `k8s/base/frontend-deployment.yaml` | 2 replicas |
| Backend Deployment (≥2 replicas) | DONE | `k8s/base/backend-deployment.yaml` | 2 replicas, rolling update |
| PostgreSQL StatefulSet + PVC | DONE | `k8s/base/postgres-statefulset.yaml` | volumeClaimTemplates |
| Redis Deployment + PVC | DONE | `k8s/base/redis-deployment.yaml`, `redis-pvc.yaml` | Persistent storage |
| ClusterIP Services | DONE | `k8s/base/*-service.yaml` | All 4 services |
| Ingress | DONE | `k8s/base/ingress.yaml` | Path-based routing |
| ConfigMap | DONE | `k8s/base/configmap.yaml` | Non-secret config |
| Secret | DONE | `k8s/base/secret.yaml` | Credentials |
| HPA | DONE | `k8s/base/backend-hpa.yaml` | min:2, max:10, CPU 60% |
| VPA (Off mode) | DONE | `k8s/base/backend-vpa.yaml` | Recommender only |
| PodDisruptionBudget | DONE | `k8s/base/backend-pdb.yaml` | minAvailable |
| Startup/liveness/readiness probes | DONE | `k8s/base/backend-deployment.yaml` | All 3 probes |
| **CI/CD** | | | |
| ci.yml | DONE | `.github/workflows/ci.yml` | Lint, test, build, scan, validate k8s, integration |
| cd.yml | DONE | `.github/workflows/cd.yml` | Build + push to GHCR + deploy |
| release.yml | DONE | `.github/workflows/release.yml` | Versioned releases |
| Trivy security scan | DONE | `.github/workflows/ci.yml` | aquasecurity/trivy-action@v0.36.0 |
| Kubeconform validation | DONE | `.github/workflows/ci.yml` | kustomize build \| kubeconform |
| Docker Compose integration test | DONE | `.github/workflows/ci.yml` | POST + GET + cache test |
| **Git & Collaboration** | | | |
| ≥35 commits | DONE | git log | 39 commits |
| ≥5 merged PRs | DONE | git log | 5 merged PRs |
| Conventional commit prefixes | DONE | git log | feat(), fix(), ci(), docs() |
| Protected main branch | DONE | `docs/evidence/branch_protection.png` | Screenshot evidence |
| **Documentation** | | | |
| README.md | DONE | `README.md` | Problem statement, architecture, quickstart, API |
| ENGINEERING-NOTES.md | DONE | `docs/ENGINEERING-NOTES.md` | Design decisions |
| RUNBOOK.md | DONE | `docs/RUNBOOK.md` | Operations guide |
| AI-USAGE.md | DONE | `docs/AI-USAGE.md` | AI tool usage disclosure |
| TRIAGE.md | DONE | `docs/TRIAGE.md` | Triage system documentation |
| ADR: Provider interface | DONE | `docs/adr/0001-provider-interface.md` | Provider abstraction decision |
| ADR: Frontend runtime config | DONE | `docs/adr/0002-frontend-runtime-config.md` | nginx proxy decision |
| ADR: Deploy by SHA | DONE | `docs/adr/0003-deploy-by-sha.md` | Immutable deployments |
| ADR: PII/data governance | DONE | `docs/adr/0004-pii-and-data-governance.md` | Data handling policy |
| Load test script | DONE | `load/k6-script.js` | k6 load test for HPA |
