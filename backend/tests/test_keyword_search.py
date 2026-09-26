"""Keyword search tests for GET /api/complaints?keyword=..."""
import pytest


async def _create(client, text: str, location: str = "Lahore") -> dict:
    resp = await client.post("/api/complaints", json={"text": text, "location": location})
    assert resp.status_code == 201
    return resp.json()


@pytest.mark.asyncio
async def test_keyword_matches_text(client):
    await _create(client, "Manhole cover missing on Jail Road near the bus stop causing accidents")
    resp = await client.get("/api/complaints?keyword=manhole")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any("manhole" in item["text"].lower() for item in data["items"])


@pytest.mark.asyncio
async def test_keyword_matches_location(client):
    await _create(
        client,
        "Garbage not collected for several days and causing smell",
        location="Cavalry Ground",
    )
    resp = await client.get("/api/complaints?keyword=cavalry")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any("cavalry" in item["location"].lower() for item in data["items"])


@pytest.mark.asyncio
async def test_keyword_no_match_returns_empty(client):
    resp = await client.get("/api/complaints?keyword=xyznonexistenttoken999")
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_keyword_case_insensitive(client):
    await _create(client, "Broken streetlight outside the main mosque every night dark")
    resp_lower = await client.get("/api/complaints?keyword=streetlight")
    resp_upper = await client.get("/api/complaints?keyword=STREETLIGHT")
    assert resp_lower.json()["total"] == resp_upper.json()["total"]


@pytest.mark.asyncio
async def test_keyword_combined_with_status_filter(client):
    complaint = await _create(
        client, "Water pipe leaking heavily near the school gate since yesterday"
    )
    resp = await client.get(
        f"/api/complaints?keyword=leaking&status={complaint['status']}"
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1
