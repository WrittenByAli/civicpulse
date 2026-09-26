import time

from app.providers.triage.base import TriageResult

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "water": [
        "water", "pipe", "burst", "flood", "leak", "sewage", "drain", "plumbing",
        "tanker", "supply", "tap", "boring", "tubewell", "wasa", "nala", "gutter",
    ],
    "electricity": [
        "electricity", "power", "outage", "lesco", "wapda",
        "electric", "voltage", "transformer", "wire", "meter",
        "load shedding", "loadshedding", "current gone", "bijli",
    ],
    "sanitation": [
        "garbage", "waste", "trash", "smell", "filth", "rubbish", "clean",
        "dump", "bin", "sweeper", "stink", "sanitation", "litter",
    ],
    "roads": [
        "road", "pothole", "pavement", "crack", "accident", "bridge",
        "highway", "footpath", "speed bump", "construction", "sinkhole",
    ],
    "streetlights": ["streetlight", "lamp", "dark", "bulb", "lighting", "light pole"],
}

_PRIORITY_KEYWORDS: dict[str, list[str]] = {
    "high": [
        "burst", "flood", "fire", "accident", "emergency",
        "urgent", "danger", "since morning", "outage", "collapse",
        "injured", "children", "sick", "health", "hazard",
        "immediately", "critical", "no water", "no electricity",
    ],
    "low": ["minor", "small", "slight", "week", "months", "sometime", "cosmetic"],
}


def _classify(text: str) -> tuple[str, str]:
    lower = text.lower()
    category = "other"
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            category = cat
            break
    priority = "normal"
    for pri, keywords in _PRIORITY_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            priority = pri
            break
    return category, priority


class RuleBasedTriage:
    def __init__(self, *, is_fallback: bool = False) -> None:
        self._is_fallback = is_fallback

    def name(self) -> str:
        return "rules:fallback" if self._is_fallback else "rules"

    async def triage(self, text: str, location: str) -> TriageResult:
        from app.metrics import triage_latency

        t0 = time.monotonic()
        category, priority = _classify(text)
        summary_text = text[:100].rstrip()
        if len(text) > 100:
            summary_text += "…"
        latency_s = time.monotonic() - t0
        triage_latency.labels(provider=self.name()).observe(latency_s)
        return TriageResult(
            category=category,
            priority=priority,
            ai_summary=summary_text[:140],
            triaged_by=self.name(),
            latency_ms=int(latency_s * 1000),
            confidence=0.75,  # rules are deterministic but medium confidence
            is_fallback=self._is_fallback,
        )
