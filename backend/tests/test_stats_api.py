"""Stats endpoint tests — structure, values, operator-only access."""
import pytest


@pytest.mark.asyncio
async def test_stats_returns_all_required_keys(client):
    resp = await client.get("/api/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert set(data.keys()) >= {"total", "by_status", "by_category", "by_priority"}


@pytest.mark.asyncio
async def test_stats_by_status_has_all_states(client):
    resp = await client.get("/api/stats")
    data = resp.json()
    for state in ("open", "in_progress", "resolved", "rejected"):
        assert state in data["by_status"], f"Missing status key: {state}"


@pytest.mark.asyncio
async def test_stats_by_category_has_all_categories(client):
    resp = await client.get("/api/stats")
    data = resp.json()
    for cat in ("water", "electricity", "sanitation", "roads", "streetlights", "other"):
        assert cat in data["by_category"], f"Missing category key: {cat}"


@pytest.mark.asyncio
async def test_stats_by_priority_has_all_priorities(client):
    resp = await client.get("/api/stats")
    data = resp.json()
    for pri in ("high", "normal", "low"):
        assert pri in data["by_priority"], f"Missing priority key: {pri}"


@pytest.mark.asyncio
async def test_stats_total_matches_sum_of_by_status(client):
    resp = await client.get("/api/stats")
    data = resp.json()
    status_sum = sum(data["by_status"].values())
    assert data["total"] == status_sum


@pytest.mark.asyncio
async def test_stats_reflect_new_complaint(client):
    before = (await client.get("/api/stats")).json()["total"]
    await client.post(
        "/api/complaints",
        json={"text": "Electricity transformer exploded near the market today", "location": "Gulberg"},
    )
    after = (await client.get("/api/stats")).json()["total"]
    assert after == before + 1


@pytest.mark.asyncio
async def test_stats_open_count_increases_after_create(client):
    before = (await client.get("/api/stats")).json()["by_status"]["open"]
    await client.post(
        "/api/complaints",
        json={"text": "Water supply line broken under the road near our house", "location": "DHA"},
    )
    after = (await client.get("/api/stats")).json()["by_status"]["open"]
    assert after == before + 1
