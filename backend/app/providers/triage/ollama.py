"""Ollama triage provider — structured output, Pydantic validation, retry + jitter."""
import asyncio
import json
import logging
import random
import time
from typing import Literal

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.metrics import fallback_counter, triage_latency
from app.providers.triage.base import TriageResult
from app.providers.triage.rules import RuleBasedTriage

logger = logging.getLogger(__name__)

_ALLOWED_RETRIES = 1
_TIMEOUT = 30.0  # local models can be slower

_PROMPT_TEMPLATE = """\
You are a municipal complaint classifier. \
Classify the complaint text delimited by <complaint> tags. \
Return ONLY a JSON object — no prose, no markdown fences.

<complaint>
{text}
</complaint>
<location>{location}</location>

JSON schema:
{{"category":"water"|"electricity"|"sanitation"|"roads"|"streetlights"|"other",
"priority":"high"|"normal"|"low",
"summary":"<one sentence max 140 chars>",
"confidence":<float 0.0-1.0>}}"""

_FALLBACK = RuleBasedTriage(is_fallback=True)

_RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class _TriageOutput(BaseModel):
    category: Literal["water", "electricity", "sanitation", "roads", "streetlights", "other"]
    priority: Literal["high", "normal", "low"]
    summary: str = Field(max_length=140)
    confidence: float = Field(ge=0.0, le=1.0, default=0.80)


class OllamaTriage:
    def __init__(self, base_url: str, model: str = "qwen2.5:1.5b") -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model

    def name(self) -> str:
        return "llm:ollama"

    async def triage(self, text: str, location: str) -> TriageResult:
        t0 = time.monotonic()
        prompt = _PROMPT_TEMPLATE.format(text=text, location=location)
        last_exc: Exception | None = None

        for attempt in range(_ALLOWED_RETRIES + 1):
            if attempt > 0:
                delay = 0.5 + random.random() * 0.5
                logger.info("Ollama triage retry %d/%d after %.2fs", attempt, _ALLOWED_RETRIES, delay)
                await asyncio.sleep(delay)
            try:
                async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                    resp = await client.post(
                        f"{self._base_url}/api/generate",
                        json={"model": self._model, "prompt": prompt, "stream": False, "format": "json"},
                    )
                if resp.status_code == 400:
                    raise ValueError(f"Ollama 400 — not retrying: {resp.text[:200]}")
                resp.raise_for_status()
                parsed = _TriageOutput.model_validate(json.loads(resp.json()["response"]))
                latency_s = time.monotonic() - t0
                triage_latency.labels(provider="llm:ollama").observe(latency_s)
                return TriageResult(
                    category=parsed.category,
                    priority=parsed.priority,
                    ai_summary=parsed.summary[:140],
                    triaged_by="llm:ollama",
                    latency_ms=int(latency_s * 1000),
                    confidence=parsed.confidence,
                    is_fallback=False,
                )
            except (httpx.TimeoutException, ValidationError) as exc:
                last_exc = exc
                logger.warning("Ollama attempt %d failed (%s: %s)", attempt + 1, type(exc).__name__, exc)
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code not in _RETRYABLE_STATUS:
                    last_exc = exc
                    break
                last_exc = exc
                logger.warning("Ollama attempt %d HTTP %d", attempt + 1, exc.response.status_code)
            except Exception as exc:
                last_exc = exc
                break

        logger.warning(
            "Triage fallback triggered",
            extra={"provider": "llm:ollama", "error_class": type(last_exc).__name__, "error": str(last_exc)},
        )
        fallback_counter.labels(original_provider="llm:ollama").inc()
        result = await _FALLBACK.triage(text, location)
        result.is_fallback = True
        return result
