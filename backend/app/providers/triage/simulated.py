"""Deterministic triage provider for CI — no network calls, no randomness."""
import hashlib
import time

from app.providers.triage.base import TriageResult

_CATEGORIES = ["water", "electricity", "sanitation", "roads", "streetlights", "other"]
_PRIORITIES = ["high", "normal", "low"]


class SimulatedTriage:
    def name(self) -> str:
        return "simulated"

    async def triage(self, text: str, location: str) -> TriageResult:
        from app.metrics import triage_latency

        t0 = time.monotonic()
        digest = int(hashlib.sha256(f"{text}{location}".encode()).hexdigest(), 16)
        category = _CATEGORIES[digest % len(_CATEGORIES)]
        priority = _PRIORITIES[(digest >> 8) % len(_PRIORITIES)]
        summary = text[:97] + "…" if len(text) > 100 else text
        latency_s = time.monotonic() - t0
        triage_latency.labels(provider="simulated").observe(latency_s)
        confidence = round(0.70 + ((digest >> 16) % 30) / 100, 2)  # deterministic 0.70-0.99
        return TriageResult(
            category=category,
            priority=priority,
            ai_summary=summary[:140],
            triaged_by="simulated",
            latency_ms=int(latency_s * 1000),
            confidence=confidence,
            is_fallback=False,
        )
