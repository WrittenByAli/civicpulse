"""Input validation tests — blank text, whitespace, phone format, injection."""
import pytest


@pytest.mark.asyncio
async def test_whitespace_only_text_returns_400(client):
    resp = await client.post(
        "/api/complaints",
        json={"text": "          ", "location": "Lahore"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_whitespace_only_location_returns_400(client):
    resp = await client.post(
        "/api/complaints",
        json={"text": "Water pipe burst outside my house for two days", "location": "   "},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_text_leading_whitespace_stripped_and_accepted(client):
    resp = await client.post(
        "/api/complaints",
        json={
            "text": "  Electricity outage in our colony for many hours  ",
            "location": "  DHA Phase 5  ",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert not data["text"].startswith(" ")
    assert not data["location"].startswith(" ")


@pytest.mark.asyncio
async def test_invalid_phone_format_returns_400(client):
    resp = await client.post(
        "/api/complaints",
        json={
            "text": "Pothole on main road causing damage to vehicles daily",
            "location": "Gulberg",
            "reporter_contact": "not-a-phone!!##",
        },
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_valid_pk_phone_accepted(client):
    resp = await client.post(
        "/api/complaints",
        json={
            "text": "Garbage not collected in our street for the past week",
            "location": "Model Town",
            "reporter_contact": "+92-300-1234567",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["reporter_contact"] == "+92-300-1234567"


@pytest.mark.asyncio
async def test_empty_reporter_contact_treated_as_null(client):
    resp = await client.post(
        "/api/complaints",
        json={
            "text": "Streetlight broken outside our building for weeks",
            "location": "Johar Town",
            "reporter_contact": "",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["reporter_contact"] is None


@pytest.mark.asyncio
async def test_text_exactly_at_minimum_length(client):
    resp = await client.post(
        "/api/complaints",
        json={"text": "1234567890", "location": "Lahore"},
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_text_one_below_minimum_returns_400(client):
    resp = await client.post(
        "/api/complaints",
        json={"text": "123456789", "location": "Lahore"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_location_at_minimum_length(client):
    resp = await client.post(
        "/api/complaints",
        json={"text": "Water supply disrupted for two days now", "location": "G10"},
    )
    assert resp.status_code == 201
