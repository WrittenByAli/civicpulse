"""API-level tests for complaint CRUD — 8 cases."""
import pytest


@pytest.mark.asyncio
async def test_create_complaint_returns_201(client):
    resp = await client.post(
        "/api/complaints",
        json={"text": "Water pipe burst on Main Street causing flooding", "location": "Main Street, Lahore"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "open"
    assert "id" in data
    assert "category" in data
    assert "priority" in data


@pytest.mark.asyncio
async def test_create_complaint_missing_text_returns_422(client):
    resp = await client.post("/api/complaints", json={"location": "Lahore"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_complaint_text_too_short_returns_422(client):
    resp = await client.post(
        "/api/complaints",
        json={"text": "short", "location": "Lahore"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_complaint_returns_correct_id(client):
    create_resp = await client.post(
        "/api/complaints",
        json={"text": "Streetlight not working near my house for days", "location": "DHA Phase 5, Lahore"},
    )
    complaint_id = create_resp.json()["id"]
    get_resp = await client.get(f"/api/complaints/{complaint_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == complaint_id


@pytest.mark.asyncio
async def test_get_nonexistent_complaint_returns_404(client):
    resp = await client.get("/api/complaints/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_complaints_returns_paginated(client):
    for i in range(3):
        await client.post(
            "/api/complaints",
            json={"text": f"Garbage not collected in our area for many days number {i}", "location": "Gulberg, Lahore"},
        )
    resp = await client.get("/api/complaints?page=1&per_page=2")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) <= 2


@pytest.mark.asyncio
async def test_status_transition_open_to_in_progress(client):
    create_resp = await client.post(
        "/api/complaints",
        json={"text": "Power outage in Model Town since last night with no update", "location": "Model Town, Lahore"},
    )
    cid = create_resp.json()["id"]
    patch_resp = await client.patch(
        f"/api/complaints/{cid}/status",
        json={"status": "in_progress"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_invalid_status_transition_returns_422(client):
    create_resp = await client.post(
        "/api/complaints",
        json={"text": "Pothole on Jail Road causing accidents every day", "location": "Jail Road, Lahore"},
    )
    cid = create_resp.json()["id"]
    # open → resolved is not allowed
    patch_resp = await client.patch(
        f"/api/complaints/{cid}/status",
        json={"status": "resolved"},
    )
    assert patch_resp.status_code == 422
