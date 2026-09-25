"""LLM triage via Groq API with RuleBasedTriage fallback."""
import json
import logging
import time

import httpx

from app.metrics import fallback_counter, triage_latency
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
{{
  "category": "water"|"electricity"|"sanitation"|"roads"|"streetlights"|"other",
  "priority": "high"|"normal"|"low",
  "summary": "<one sentence, max 140 chars>"
}}"""

_FALLBACK = RuleBasedTriage(is_fallback=True)


class LLMTriage:
    def __init__(self, api_key: str, model: str = "llama-3.1-8b-instant") -> None:
        self._api_key = api_key
        self._model = model

    def name(self) -> str:
        return "llm:groq"

    async def triage(self, text: str, location: str) -> TriageResult:
        t0 = time.monotonic()
        prompt = _PROMPT_TEMPLATE.format(
            # Complaint text is treated as untrusted data — delimited by XML tags
            text=text,
            location=location,
        )
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self._model,
                        "messages": [{"role": "user", "content": prompt}],
                        "response_format": {"type": "json_object"},
                        "max_tokens": 256,
                    },
                )
                resp.raise_for_status()
                body = resp.json()
                raw = body["choices"][0]["message"]["content"]
                parsed = json.loads(raw)
                latency_s = time.monotonic() - t0
                triage_latency.labels(provider="llm:groq").observe(latency_s)
                return TriageResult(
                    category=parsed.get("category", "other"),
                    priority=parsed.get("priority", "normal"),
                    ai_summary=str(parsed.get("summary", ""))[:140],
                    triaged_by="llm:groq",
                    latency_ms=int(latency_s * 1000),
                    is_fallback=False,
                )
        except Exception as exc:
            # Spec: one WARNING per fallback with provider and error class
            logger.warning(
                "Triage fallback triggered",
                extra={
                    "provider": "llm:groq",
                    "error_class": type(exc).__name__,
                    "error": str(exc),
                },
            )
            fallback_counter.labels(original_provider="llm:groq").inc()
            result = await _FALLBACK.triage(text, location)
            result.is_fallback = True
            return result
