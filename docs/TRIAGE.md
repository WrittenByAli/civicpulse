# AI Triage System

## Overview

CivicPulse uses an AI-powered triage system to automatically categorise, prioritise, and summarise incoming municipal complaints. The system is designed around a provider abstraction so the underlying AI engine can be swapped without changing application code.

## Provider Architecture

```
TriageProvider (abstract base)
├── LLMTriage        — Groq cloud API (llama-3.3-70b)
├── OllamaTriage     — Local Ollama instance
├── RuleBasedTriage  — Keyword matching, no external deps
└── SimulatedTriage  — Deterministic, used in CI/tests
```

Selection is controlled by the `TRIAGE_PROVIDER` environment variable:

| Value | Provider | Use Case |
|---|---|---|
| `llm` | LLMTriage | Production with Groq API key |
| `ollama` | OllamaTriage | Offline/air-gapped environments |
| `rules` | RuleBasedTriage | No AI dependency, keyword matching |
| `simulated` | SimulatedTriage | CI pipelines and test suites |

## Triage Output

Every provider returns a structured `TriageResult`:

```python
class TriageResult(BaseModel):
    category: Category        # water | electricity | sanitation | roads | streetlights | other
    priority: Priority        # high | normal | low
    summary: str              # One-line AI-generated summary
    confidence: float         # 0.0 – 1.0
```

All AI output is validated by Pydantic before being stored. If the AI returns an invalid category or priority value, the response is rejected.

## Fallback Behaviour

If the primary provider (LLM/Ollama) fails:

```
Request → Primary Provider
              │
         ┌────┴────┐
         │ SUCCESS  │ → return result, triaged_by = "llm:groq"
         └─────────┘
              │
         ┌────┴────┐
         │  FAIL   │ → retry once with jitter
         └─────────┘
              │
         ┌────┴────┐
         │  FAIL   │ → RuleBasedTriage fallback
         └─────────┘
              │
              → return result, triaged_by = "rules:fallback"
```

The complaint submission always succeeds (HTTP 201). The `triaged_by` field records which provider actually handled the request.

## Retry Policy

- Timeout: 10 seconds per attempt
- Retries: 1 retry for timeout, 429, and 5xx errors
- Jitter: randomised backoff between retries
- No retry for 400-level errors (invalid request)

## Prompt Injection Protection

- User complaint text is placed in a clearly delimited data section
- The system prompt instructs the model to treat the complaint as data only
- Output is validated against strict Pydantic enums
- API keys are never logged

## Latency Tracking

Every triage call records `triage_latency_ms` in the complaint row, enabling performance monitoring across providers.

## Category Keywords (RuleBasedTriage)

| Category | Keywords |
|---|---|
| water | water, pipe, burst, flood, leak, supply, tanker |
| electricity | electricity, light, power, bijli, load, transformer |
| sanitation | garbage, waste, sewage, drain, gutter, trash, smell |
| roads | road, pothole, crack, asphalt, highway, bridge |
| streetlights | streetlight, lamp, pole, dark, bulb |
| other | fallback when no keywords match |

## Configuration

```env
TRIAGE_PROVIDER=llm          # Provider selection
GROQ_API_KEY=gsk_...         # Required for llm provider
OLLAMA_BASE_URL=http://ollama:11434  # Required for ollama provider
OLLAMA_MODEL=qwen2.5:1.5b   # Model for ollama provider
```
