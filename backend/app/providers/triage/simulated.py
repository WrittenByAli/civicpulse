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
        t0 = time.monotonic()
        digest = int(hashlib.sha256(f"{text}{location}".encode()).hexdigest(), 16)
        category = _CATEGORIES[digest % len(_CATEGORIES)]
        priority = _PRIORITIES[(digest >> 8) % len(_PRIORITIES)]
        summary = text[:97] + "…" if len(text) > 100 else text
        latency_ms = int((time.monotonic() - t0) * 1000)
        return TriageResult(
            category=category,
            priority=priority,
            ai_summary=summary[:140],
            triaged_by="simulated",
            latency_ms=latency_ms,
        )
