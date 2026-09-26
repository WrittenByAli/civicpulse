"""Pagination and filtering tests for the complaints list endpoint."""
import pytest


async def _create(client, text_suffix: str = "", location: str = "Lahore") -> dict:
    resp = await client.post(
        "/api/complaints",
        json={
            "text": f"Water supply issue in our street, needs immediate attention {text_suffix}",
            "location": location,
        },
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.mark.asyncio
async def test_per_page_one_returns_single_item(client):
    await _create(client, "A")
    await _create(client, "B")
    resp = await client.get("/api/complaints?page=1&per_page=1")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["per_page"] == 1


@pytest.mark.asyncio
async def test_page_beyond_total_returns_empty_items(client):
    resp = await client.get("/api/complaints?page=9999&per_page=10")
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []


@pytest.mark.asyncio
async def test_pages_field_calculated_correctly(client):
    for i in range(5):
        await _create(client, str(i))
    resp = await client.get("/api/complaints?per_page=2")
    data = resp.json()
    assert data["pages"] == (data["total"] + 1) // 2


@pytest.mark.asyncio
async def test_filter_by_category_returns_only_matching(client):
    resp = await client.get("/api/complaints?category=water")
    assert resp.status_code == 200
    for item in resp.json()["items"]:
        assert item["category"] == "water"


@pytest.mark.asyncio
async def test_filter_by_priority_high(client):
    resp = await client.get("/api/complaints?priority=high")
    assert resp.status_code == 200
    for item in resp.json()["items"]:
        assert item["priority"] == "high"


@pytest.mark.asyncio
async def test_invalid_category_returns_422(client):
    resp = await client.get("/api/complaints?category=notacategory")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_invalid_priority_returns_422(client):
    resp = await client.get("/api/complaints?priority=urgent")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_total_increases_after_create(client):
    before = (await client.get("/api/complaints")).json()["total"]
    await _create(client, "new complaint for total check")
    after = (await client.get("/api/complaints")).json()["total"]
    assert after == before + 1
