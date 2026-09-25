# ADR 0002 — Frontend Runtime Configuration

**Date:** 2026-09-25
**Status:** Accepted

## Context

A Vite build bakes `import.meta.env` values into static JavaScript at build time. If the backend API URL is baked in, the image is environment-specific and build-once-deploy-many is broken: we would need a separate image per environment.

Two solutions exist:
1. Serve `/config.js` generated at container start from environment variables
2. Proxy `/api` through nginx so the frontend never needs an absolute backend URL

## Decision

**Proxy `/api` through nginx.** The nginx configuration proxies all `/api/*` requests to `http://backend:8000`, so the frontend only ever calls a relative path (`/api/complaints`).

```nginx
location /api/ {
    proxy_pass http://backend:8000;
}
```

## Rationale

- **Simpler.** No entrypoint script needed; no `window.__CONFIG__` in the frontend.
- **Strictly build-once-deploy-many.** The built JS contains no URLs at all. The same image runs in dev, staging, and prod without modification.
- **Security benefit.** The frontend container never holds the backend's internal address; nginx is the only component that knows it.

## Alternatives considered

- **/config.js generated at startup:** Requires an entrypoint shell script that writes `window.CONFIG = { apiUrl: "${API_URL}" }` and a corresponding JS read on app load. More moving parts. Rejected in favour of the simpler proxy approach.
- **Bake URL at build time (`VITE_API_URL`):** Destroys build-once-deploy-many. Deduction risk (−8). Firmly rejected.

## Consequences

The nginx container must be on the `edge` network to reach the backend. The backend must be reachable at the hostname `backend` within that network. Both are satisfied by the Compose and Kubernetes service naming.
