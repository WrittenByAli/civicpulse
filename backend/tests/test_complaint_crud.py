"""Complaint CRUD tests — create, read, status transition, 404 cases."""
import pytest


@pytest.mark.asyncio
async def test_create_complaint_returns_201(client):
    resp = await client.post(
        "/api/complaints",
        json={"text": "Broken water pump near the park entrance", "location": "F-7"},
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_create_sets_status_to_open(client):
    resp = await client.post(
        "/api/complaints",
        json={"text": "Pothole in the middle of the main road causing accidents", "location": "G-9"},
    )
    assert resp.json()["status"] == "open"


@pytest.mark.asyncio
async def test_create_returns_triage_fields(client):
    resp = await client.post(
        "/api/complaints",
        json={"text": "Streetlight outside the mosque has been out for two weeks", "location": "I-8"},
    )
    data = resp.json()
    assert "category" in data
    assert "priority" in data
    assert "ai_summary" in data
    assert "triaged_by" in data


@pytest.mark.asyncio
async def test_get_complaint_by_id(client):
    create_resp = await client.post(
        "/api/complaints",
        json={"text": "Sewage overflow on the main street near the market", "location": "H-13"},
    )
    cid = create_resp.json()["id"]
    get_resp = await client.get(f"/api/complaints/{cid}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == cid


@pytest.mark.asyncio
async def test_get_nonexistent_complaint_returns_404(client):
    resp = await client.get("/api/complaints/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_complaints_returns_paginated_response(client):
    resp = await client.get("/api/complaints")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "per_page" in data
    assert "pages" in data


@pytest.mark.asyncio
async def test_list_page_2_with_per_page_1(client):
    for i in range(3):
        await client.post(
            "/api/complaints",
            json={"text": f"Garbage pile near school gate blocking pedestrians entry {i}", "location": "E-11"},
        )
    resp = await client.get("/api/complaints?page=2&per_page=1")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["page"] == 2


@pytest.mark.asyncio
async def test_created_at_is_present(client):
    resp = await client.post(
        "/api/complaints",
        json={"text": "Water tanker supply stopped without any notice to residents", "location": "D-12"},
    )
    data = resp.json()
    assert data.get("created_at") is not None
