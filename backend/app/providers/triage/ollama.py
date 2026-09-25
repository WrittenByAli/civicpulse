"""Ollama triage provider with RuleBasedTriage fallback."""
import json
import logging
import time

import httpx

from app.providers.triage.base import TriageResult
from app.providers.triage.rules import RuleBasedTriage

logger = logging.getLogger(__name__)

_PROMPT_TEMPLATE = """\
You are a municipal complaint classifier. Classify the following complaint.

<complaint>
{text}
</complaint>
<location>{location}</location>

Respond with JSON only, no explanation. Schema:
{{"category":"water"|"electricity"|"sanitation"|"roads"|"streetlights"|"other","priority":"high"|"normal"|"low","summary":"<one sentence max 140 chars>"}}"""

_FALLBACK = RuleBasedTriage(is_fallback=True)


class OllamaTriage:
    def __init__(self, base_url: str, model: str = "qwen2.5:1.5b") -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model

    def name(self) -> str:
        return "llm:ollama"

    async def triage(self, text: str, location: str) -> TriageResult:
        t0 = time.monotonic()
        prompt = _PROMPT_TEMPLATE.format(text=text, location=location)
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self._base_url}/api/generate",
                    json={"model": self._model, "prompt": prompt, "stream": False, "format": "json"},
                )
                resp.raise_for_status()
                body = resp.json()
                parsed = json.loads(body["response"])
                latency_ms = int((time.monotonic() - t0) * 1000)
                return TriageResult(
                    category=parsed.get("category", "other"),
                    priority=parsed.get("priority", "normal"),
                    ai_summary=str(parsed.get("summary", ""))[:140],
                    triaged_by="llm:ollama",
                    latency_ms=latency_ms,
                )
        except Exception as exc:
            logger.warning("Ollama triage failed, falling back to rules: %s", exc)
            return await _FALLBACK.triage(text, location)
