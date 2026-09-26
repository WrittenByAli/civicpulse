# Contributing to CivicPulse

## Branching strategy

```
main          — stable, protected; merged via PR only
frontend      — active development branch
feat/<name>   — feature branches, branch off frontend
fix/<name>    — bug-fix branches
```

All changes go through a pull request. Direct pushes to `main` are blocked.

## Local setup

```bash
cp .env.example .env          # fill in real values
docker compose up --build -d  # starts postgres, redis, backend, frontend, ollama
```

Backend runs at **http://localhost:8000**, frontend at **http://localhost:80**.  
API docs: **http://localhost:8000/docs**

## Running tests

```bash
# Backend
cd backend
pip install -e ".[dev]"
pytest --cov=app --cov-report=term-missing

# Frontend
cd frontend
npm install
npm test -- --run
```

## Commit message format

```
<type>(<scope>): <short summary>

Types: feat | fix | test | docs | chore | refactor | ci
```

Examples:
- `feat(backend): add keyword search to complaints list`
- `fix(k8s): correct ingress rewrite-target for health endpoints`
- `test(backend): add auth API tests`

## Code standards

- **Backend:** `ruff` for linting, `mypy --strict` for types. Run `ruff check .` before committing.
- **Frontend:** `tsc --noEmit` must pass. No `any` casts without a comment.
- **K8s:** All manifests must pass `kubectl apply --dry-run=client` against the base overlay.
- **No secrets in git.** Use `.env` locally; Kubernetes secrets use `CHANGE_ME` placeholders in the repo.

## Pull request checklist

- [ ] Tests pass (`pytest` + `npm test`)
- [ ] `check_submission.py` reports no errors
- [ ] No `:latest` image tags in k8s manifests
- [ ] `.env` is not staged
- [ ] PR description explains *why*, not just *what*
