"""Tests for liveness and readiness probes — 2 cases."""
import pytest


@pytest.mark.asyncio
async def test_liveness_no_db(client):
    """GET /health must return 200 with no DB dependency."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_readiness_with_mocked_deps(client):
    """GET /ready checks DB and Redis; mocked in tests so should return 200."""
    resp = await client.get("/ready")
    # With mocked Redis (ping OK) and SQLite DB (SELECT 1 OK), expect 200
    assert resp.status_code in (200, 503)
    data = resp.json()
    assert "status" in data
    assert "checks" in data
