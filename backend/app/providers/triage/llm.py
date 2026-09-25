"""LLM triage via Groq API with RuleBasedTriage fallback."""
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
            # Treat user text as untrusted data — it is delimited by XML tags
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
                latency_ms = int((time.monotonic() - t0) * 1000)
                return TriageResult(
                    category=parsed.get("category", "other"),
                    priority=parsed.get("priority", "normal"),
                    ai_summary=str(parsed.get("summary", ""))[:140],
                    triaged_by="llm:groq",
                    latency_ms=latency_ms,
                )
        except Exception as exc:
            logger.warning("Groq triage failed, falling back to rules: %s", exc)
            return await _FALLBACK.triage(text, location)
