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
    assert r1.confidence == r2.confidence


@pytest.mark.asyncio
async def test_simulated_provider_name():
    assert SimulatedTriage().name() == "simulated"


@pytest.mark.asyncio
async def test_simulated_confidence_range():
    provider = SimulatedTriage()
    result = await provider.triage("Some complaint text for testing", "Lahore")
    assert 0.0 <= result.confidence <= 1.0


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
async def test_rules_triage_sanitation_keyword():
    provider = RuleBasedTriage()
    result = await provider.triage("Garbage has not been collected for a week and the area stinks", "Lahore")
    assert result.category == "sanitation"


@pytest.mark.asyncio
async def test_rules_triage_roads_keyword():
    provider = RuleBasedTriage()
    result = await provider.triage("Large pothole on the main road causing accidents", "Lahore")
    assert result.category == "roads"


@pytest.mark.asyncio
async def test_rules_triage_streetlights_keyword():
    provider = RuleBasedTriage()
    result = await provider.triage("The streetlight on our block has been broken for two weeks", "Lahore")
    assert result.category == "streetlights"


@pytest.mark.asyncio
async def test_rules_triage_other_category():
    provider = RuleBasedTriage()
    result = await provider.triage("I need to register a general concern about the neighbourhood", "Lahore")
    assert result.category == "other"


@pytest.mark.asyncio
async def test_rules_triage_high_priority():
    provider = RuleBasedTriage()
    result = await provider.triage("Water pipe burst and flooding the entire street right now", "Lahore")
    assert result.priority == "high"


@pytest.mark.asyncio
async def test_rules_triage_low_priority():
    provider = RuleBasedTriage()
    result = await provider.triage("Minor crack in the road, has been like this for months", "Lahore")
    assert result.priority == "low"


@pytest.mark.asyncio
async def test_rules_triage_normal_priority_default():
    provider = RuleBasedTriage()
    result = await provider.triage("Water supply is not available in our area", "Lahore")
    assert result.priority == "normal"


@pytest.mark.asyncio
async def test_rules_triage_fallback_name():
    provider = RuleBasedTriage(is_fallback=True)
    assert provider.name() == "rules:fallback"
    result = await provider.triage("Unknown complaint about something", "Lahore")
    assert result.triaged_by == "rules:fallback"
    assert result.is_fallback is True


@pytest.mark.asyncio
async def test_triage_result_summary_truncated():
    provider = SimulatedTriage()
    long_text = "x" * 2000
    result = await provider.triage(long_text, "Lahore")
    assert len(result.ai_summary) <= 140


@pytest.mark.asyncio
async def test_rules_triage_latency_recorded():
    provider = RuleBasedTriage()
    result = await provider.triage("Water leak in our street", "Lahore")
    assert result.latency_ms >= 0


@pytest.mark.asyncio
async def test_rules_triage_summary_not_empty():
    provider = RuleBasedTriage()
    result = await provider.triage("Electricity transformer is sparking dangerously", "Lahore")
    assert result.ai_summary
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
