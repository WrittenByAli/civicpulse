"""Tests for AI structured output validation — Pydantic rejects invalid LLM responses."""
import pytest
from pydantic import ValidationError

from app.providers.triage.llm import _TriageOutput


def test_valid_triage_output():
    result = _TriageOutput(
        category="water",
        priority="high",
        summary="Burst water pipe flooding residential area.",
        confidence=0.94,
    )
    assert result.category == "water"
    assert result.priority == "high"
    assert result.confidence == 0.94


def test_invalid_category_rejected():
    with pytest.raises(ValidationError):
        _TriageOutput(
            category="weather_problem",
            priority="high",
            summary="Some summary",
            confidence=0.9,
        )


def test_invalid_priority_rejected():
    with pytest.raises(ValidationError):
        _TriageOutput(
            category="water",
            priority="URGENT",
            summary="Some summary",
            confidence=0.9,
        )


def test_summary_over_140_chars_rejected():
    with pytest.raises(ValidationError):
        _TriageOutput(
            category="water",
            priority="high",
            summary="x" * 141,
            confidence=0.9,
        )


def test_confidence_above_one_rejected():
    with pytest.raises(ValidationError):
        _TriageOutput(
            category="water",
            priority="high",
            summary="Valid summary",
            confidence=2.5,
        )


def test_confidence_below_zero_rejected():
    with pytest.raises(ValidationError):
        _TriageOutput(
            category="water",
            priority="high",
            summary="Valid summary",
            confidence=-0.1,
        )


def test_default_confidence():
    result = _TriageOutput(
        category="roads",
        priority="normal",
        summary="Pothole on main road.",
    )
    assert result.confidence == 0.85


@pytest.mark.asyncio
async def test_meta_providers_endpoint(client):
    """GET /api/meta/providers returns active provider and cache info."""
    resp = await client.get("/api/meta/providers")
    assert resp.status_code == 200
    data = resp.json()
    assert "active_provider" in data
    assert "last_outcomes" in data
    assert "cache_hit_rate" in data
