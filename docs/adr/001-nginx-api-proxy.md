# ADR 001 — Frontend API routing: nginx proxy over baked-in URL

**Status:** Accepted  
**Date:** 2026-09-25

## Context

A Vite build compiles `import.meta.env.VITE_*` values into static JavaScript at build
time. If the backend API URL is injected this way, the resulting Docker image is
environment-specific: a dev image hard-codes `http://localhost:8000`, a prod image
hard-codes the production hostname. The same image cannot be deployed to both
environments without a rebuild — this breaks the build-once-deploy-many principle and
defeats image immutability.

Two patterns solve this:

1. **Runtime `config.js`** — nginx serves a small `/config.js` generated at container
   start from environment variables; the SPA fetches it before mounting.

2. **nginx reverse proxy** — nginx routes `/api/*` to the backend service; the SPA
   uses relative paths like `/api/complaints` and never needs an absolute URL at all.

## Decision

We use **option 2: nginx reverse proxy**.

```nginx
location /api/ {
    proxy_pass http://backend:8000;
}
```

The frontend JavaScript contains no hostname, port, or protocol. Every API call uses a
relative path. nginx resolves the backend address at request time from its own
configuration, which is environment-specific — not the image.

## Consequences

**Good:**
- The frontend image is truly environment-agnostic. The same image runs in dev compose,
  staging K8s, and production K8s without rebuilding.
- No secrets or environment-specific values can accidentally end up in the JS bundle.
- The SPA and backend share the same origin, so no CORS preflight on API calls.
- Vite's dev server has a matching `proxy` block, so local development (`npm run dev`)
  behaves identically to production without any extra configuration.

**Trade-off:**
- nginx must know the backend's service name at container start. In Docker Compose this
  is `backend`; in Kubernetes it is the service DNS name. This is handled in
  `nginx.conf` which is baked into the image — if the backend service name ever changes,
  the frontend image must be rebuilt. This is acceptable: the service name is part of
  the deployment contract, not a per-environment variable.

## Rejected alternative

Option 1 (runtime `config.js`) adds moving parts: an `entrypoint.sh` script, an extra
fetch before mount, error handling if the fetch fails, and a test for the generation
logic. For a two-service app where the backend name is stable, this complexity is not
justified.
