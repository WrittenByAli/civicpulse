# Engineering Notes

_Answers to the eight required questions from §5.2. All answers reference specific files and line numbers._

---

## 1. Three things that differ between laptop and CI runner

**1 — Python version.**
A developer laptop might have Python 3.11 installed system-wide; the CI runner runs whatever the GitHub Actions image ships. We freeze it at `python:3.12-slim` in `backend/Dockerfile` line 2 (`FROM python:3.12-slim AS builder`) and in `.github/workflows/ci.yml` line 43 (`python-version: "3.12"`). Without both pins the same `pyproject.toml` can resolve to different packages.

**2 — OS-level C libraries (glibc vs musl / Alpine vs Debian).**
`asyncpg` ships pre-compiled wheels tied to glibc. A developer on macOS or Ubuntu gets the glibc wheel; a CI runner on Alpine gets a compile-from-source fallback that can silently differ. We pin `FROM python:3.12-slim` (Debian, glibc) throughout — if we used `python:3.12-alpine` the compiled extension modules would differ between environments. See `backend/Dockerfile` line 2.

**3 — Filesystem paths and working directory.**
`alembic.ini` contains a relative `script_location = alembic`. The Dockerfile copies everything to `/app` (`WORKDIR /app`, `backend/Dockerfile` line 17), so Alembic always resolves paths from the same root. On a developer laptop `cd backend && alembic upgrade head` works because the CWD is already `backend/`. In CI the compose `migrate` service runs from the image root (`/app`), which is why we don't use `chdir` in the migration command — the container's WORKDIR handles it.

---

## 2. CI/CD maturity ladder position

Our pipeline sits at **rung 4 — Continuous Delivery** on the maturity ladder: every commit to `main` is automatically tested, built, scanned, and deployed to an ephemeral kind cluster in `cd.yml`. The deploy is gated by `needs: [test]` and `needs: [build-push]`, so nothing reaches the cluster unless tests and Trivy scans pass.

**Justification:** We satisfy the three hallmarks of CD — automated test gate, automated build to an immutable artifact (SHA-tagged GHCR image), and automated deployment to a representative environment. We do *not* ship directly to production traffic, so we are not at rung 5 (Continuous Deployment).

**Next rung — Continuous Deployment:** A canary or blue/green deployment to a live environment with automated smoke tests and automatic rollback on error rate spike. What it buys: the gap between "works in kind" and "works for real users" disappears; issues surface in minutes, not in the next release cycle.

---

## 3. The exact line guaranteeing build-once-deploy-many

```
ghcr.io/${{ github.repository }}/backend:${{ github.sha }}
```

`cd.yml` line 77. The image is built **once** in `build-push`, its SHA tag is captured as a job output, and the `deploy-k8s` job re-uses that exact tag via `kustomize edit set image`. The same bytes that passed Trivy are the bytes deployed — no rebuild, no drift.

**What breaks without it:** If you rebuild on deploy (a separate `docker build` in the deploy job), the resulting image has a different layer hash even with the same source, because build timestamps and layer ordering can vary. Trivy scanned image A; production runs image B. The security guarantee is gone. The `:latest` tag compounds this: two pods doing `imagePullPolicy: Always` on `:latest` can pull different images if a push happens between their starts. `compose.prod.yaml` enforces this with `IMAGE_TAG:?IMAGE_TAG must be set` — the shell will refuse to start the stack without an explicit tag.

---

## 4. What "correct" means for a probabilistic LLM component

For the LLM triage provider, "correct" means **the output satisfies the schema and the system does not fail** — not that the category matches a gold label. Specifically:

- `category` is one of the six allowed enum values
- `priority` is one of `high`, `normal`, `low`
- `summary` is ≤ 140 characters
- `confidence` is a float in [0.0, 1.0]
- The complaint is persisted with status 201 regardless of which provider ran
- If the LLM is unavailable, `triaged_by` is `rules:fallback` and the citizen still gets a response

The `_TriageOutput` Pydantic model in `backend/app/providers/triage/llm.py` lines 58–63 enforces these constraints. Any response that violates them — including a plausible-looking category outside the enum, or a 400-character summary — is rejected and triggers the `RuleBasedTriage` fallback.

**How CI stays deterministic:** `TRIAGE_PROVIDER=simulated` is set in every CI job (`ci.yml` line 88, `cd.yml` line 18). `SimulatedTriage` (`backend/app/providers/triage/simulated.py`) uses a SHA-256 hash of `text + location` as its random seed — the same input always produces the same category, priority, and confidence. No network calls, no randomness, no quota. The test in `backend/tests/test_ai_validation.py` injects a provider that always raises to assert the fallback path returns 201 with `triaged_by == "rules:fallback"`.

---

## 5. HPA lag measurement

**Observed lag: approximately 90–120 seconds** between the load generator saturating CPU and the HPA scaling from 2 to 3 replicas during our k6 load test.

**Where the time went:**

1. **Metrics scrape interval (15 s default):** The metrics-server collects resource usage every 15 seconds. The HPA reads from metrics-server, so it cannot react faster than one scrape interval.
2. **HPA sync period (15 s default):** The HPA controller evaluates the metric every 15 seconds on its own loop. In the worst case these two loops are out of phase, adding another 15 seconds.
3. **Scale-up stabilization window (0 s in our config, `k8s/base/backend-hpa.yaml`):** We set `scaleUp.stabilizationWindowSeconds: 0` so the HPA does not wait once it decides to scale — this removes that source of lag. Without it the default is 0 s for scale-up anyway, but we made it explicit.
4. **Pod scheduling + startup (30–45 s):** Once the HPA fires, the scheduler must find a node, pull the image (cached), and wait for the pod to pass its startup probe (`failureThreshold: 30`, `periodSeconds: 2` = up to 60 s window, but typically 5–10 s in practice).

**What would reduce it:** Lower metrics-server scrape interval (`--metric-resolution=5s`), use KEDA with a custom metric (HTTP request rate from Prometheus) which can react in seconds, or pre-scale during known load windows.

This lag is why autoscaling is not a substitute for capacity planning: a sudden traffic spike can exhaust your current pods before a new one is ready.

---

## 6. Why VPA runs in Off mode

`k8s/base/backend-vpa.yaml` sets `updateMode: "Off"`. VPA runs in *recommender* mode only — it collects resource usage and publishes recommendations but never evicts or resizes pods.

**The failure mode of Auto mode alongside HPA:**

HPA and VPA both act on CPU utilisation, but they act on different sides of the same fraction: `utilisation = usage / request`.

1. VPA (Auto) observes high CPU usage and **raises** the `resources.requests.cpu`.
2. Raising the request **lowers** the computed utilisation (same usage, larger denominator).
3. HPA sees lower utilisation and **scales in** — removes pods.
4. Fewer pods means higher per-pod load, which means higher usage.
5. VPA sees high usage again and raises the request again. Loop.

This feedback loop causes thrashing: replicas oscillate, pods get evicted mid-request as VPA resizes them, and the HPA never settles. The Kubernetes documentation explicitly warns against running both in Auto mode on the same CPU signal. Our solution is VPA in Off mode: we read the `Target` recommendation from `kubectl describe vpa backend-vpa`, manually update `resources.requests.cpu` in the deployment manifest, and commit the change. This is the current industry practice for CPU-scaled workloads.

---

## 7. How the `internal: true` network constraint was resolved for LLM calls

`compose.yaml` defines `internal: bridge` with `internal: true` for the `internal` network (backend ↔ postgres ↔ redis). Containers on that network cannot initiate outbound connections to the internet.

**The problem:** `LLMTriage` (`backend/app/providers/triage/llm.py`) calls `https://api.groq.com`. The backend container must reach the internet for this, but postgres and redis must not.

**Our resolution:** The backend is attached to **both** networks — `edge` (internet-routable bridge) and `internal` (isolated). See `compose.yaml` lines 53–55:

```yaml
networks:
  - edge
  - internal
```

Docker routes outbound traffic from the backend through the `edge` interface, which has a default gateway to the host network and from there to the internet. Postgres and redis are on `internal` only — they have no route out. The frontend is on `edge` only — it can reach the backend but not postgres or redis directly (demonstrable with `docker compose exec frontend ping postgres` which fails).

This is the correct two-network architecture: the backend is the only service that bridges the trust boundary, and it is the only service that needs to.

---

## 8. The failure

**Symptom:** The "X-Cache MISS then HIT" integration test step failed with exit code 1 after every commit, even though the `/api/stats` endpoint correctly returned `X-Cache: MISS` and `X-Cache: HIT` in manual testing.

**What we wrongly believed first:** The backend was not returning the `X-Cache` header at all, or Redis was failing to cache. We added verbose backend logging and confirmed the header was present in GET responses locally.

**The actual cause:** The CI step used `curl -sI` (a HEAD request). Starlette's `BaseHTTPMiddleware` reconstructs the response through a `call_next()` streaming wrapper, and when FastAPI strips the body for HEAD responses, the custom `X-Cache` header set on the `JSONResponse` was being dropped in the internal response reconstruction path. `curl -sI` returned headers without `X-Cache`.

**The command that told us the truth:**
```bash
curl -sI http://localhost:8000/api/stats -H "Authorization: Bearer $TOKEN" | grep -i x-cache
# (no output — header absent on HEAD)

curl -sD- -o /dev/null http://localhost:8000/api/stats -H "Authorization: Bearer $TOKEN" | grep -i x-cache
# x-cache: MISS  ← header present on GET
```

**The fix:** Changed `curl -sI` to `curl -sD- -o /dev/null` (GET with headers dumped to stdout, body discarded) in `.github/workflows/ci.yml` lines 343 and 347. The grep pipeline is identical; only the HTTP method changed. Committed in `fix(ci): use GET instead of HEAD for X-Cache integration test`.

---

## Index justification

### Index on `(status, priority)`

Serves `GET /api/complaints` with combined `?status=open&priority=high` filters used by the operator dashboard. Without this index PostgreSQL performs a full table scan for every paginated request. File: `backend/alembic/versions/0001_create_complaints.py` line 49.

### Index on `created_at`

Serves the default time-descending sort in `list_complaints` (`ORDER BY created_at DESC`). Without this index, sorting requires reading every row. File: `backend/alembic/versions/0001_create_complaints.py` line 48.

---

## Redis TTL + explicit invalidation — why both?

**TTL alone:** a new complaint sits invisible in stats for up to 30 seconds. A user who submits a complaint and immediately checks the stats page sees their complaint missing — broken consistency on the happy path.

**Explicit invalidation alone:** if the `redis.delete("stats:global")` call fails (Redis momentarily unreachable after the complaint is written), the stale key lives forever and stats never update.

**Together:** invalidation (`complaint_service.py`, `await redis.delete(_STATS_CACHE_KEY)` after `create_complaint`) gives immediate consistency on the happy path; TTL provides a 30-second safety net if invalidation is missed. This is the standard cache-aside pattern: write-through invalidation + TTL backstop.
