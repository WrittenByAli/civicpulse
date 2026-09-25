"""Tests for triage providers — SimulatedTriage and RuleBasedTriage."""
import pytest

from app.providers.triage.rules import RuleBasedTriage
from app.providers.triage.simulated import SimulatedTriage


@pytest.mark.asyncio
async def test_simulated_triage_is_deterministic():
    provider = SimulatedTriage()
    text = "Water pipe burst on Main Street causing flooding"
    location = "Lahore"
    r1 = await provider.triage(text, location)
    r2 = await provider.triage(text, location)
    assert r1.category == r2.category
    assert r1.priority == r2.priority
    assert r1.ai_summary == r2.ai_summary


@pytest.mark.asyncio
async def test_simulated_provider_name():
    assert SimulatedTriage().name() == "simulated"


@pytest.mark.asyncio
async def test_rules_triage_water_keyword():
    provider = RuleBasedTriage()
    result = await provider.triage("Water pipe burst on the street", "Lahore")
    assert result.category == "water"
    assert result.triaged_by == "rules"


@pytest.mark.asyncio
async def test_rules_triage_electricity_keyword():
    provider = RuleBasedTriage()
    result = await provider.triage("Power outage since last night, LESCO not responding", "Lahore")
    assert result.category == "electricity"


@pytest.mark.asyncio
async def test_rules_triage_fallback_name():
    provider = RuleBasedTriage(is_fallback=True)
    assert provider.name() == "rules:fallback"
    result = await provider.triage("Unknown complaint about something", "Lahore")
    assert result.triaged_by == "rules:fallback"


@pytest.mark.asyncio
async def test_triage_result_summary_truncated():
    provider = SimulatedTriage()
    long_text = "x" * 2000
    result = await provider.triage(long_text, "Lahore")
    assert len(result.ai_summary) <= 140


@pytest.mark.asyncio
async def test_stats_endpoint(client):
    resp = await client.get("/api/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "by_status" in data
    assert "by_category" in data
    assert "by_priority" in data
    assert "X-Cache" in resp.headers
