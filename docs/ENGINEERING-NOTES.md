# Engineering Notes

_Answers to the eight required questions from §5.2. All answers reference specific files and line numbers._

## 1. Three things that differ between laptop and CI runner

_To be filled in after implementation._

## 2. CI/CD maturity ladder position

_To be filled in after CI is configured._

## 3. The exact line guaranteeing build-once-deploy-many

_To be filled in after Docker images are built._

## 4. What "correct" means for a probabilistic LLM component

_To be filled in after AI layer is implemented._

## 5. HPA lag measurement

_To be filled in after load testing._

## 6. Why VPA runs in Off mode

_To be filled in after Kubernetes is configured._

## 7. How the internal: true network constraint was resolved for LLM calls

_To be filled in after Docker Compose is configured._

## 8. The failure

_To be filled in at the end of the project._

---

## Index justification

### Index on (status, priority)

Serves the `GET /api/complaints` dashboard query which always filters by status and/or priority. Without this index, every filter requires a full table scan. File: `backend/alembic/versions/`.

### Index on created_at

Serves the time-sorted listing (default sort) and any time-range queries. File: `backend/alembic/versions/`.

## Redis TTL + explicit invalidation — why both?

TTL alone: a new complaint sits invisible in stats for up to 30 seconds.
Explicit invalidation alone: if the invalidation call fails (Redis unreachable at that moment), stale data lives forever.
Together: invalidation gives immediate consistency on the happy path; TTL provides a safety net if invalidation is missed.
