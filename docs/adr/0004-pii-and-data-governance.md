# ADR 0004 — PII and Data Governance for LLM Triage

**Date:** 2026-09-25
**Status:** Accepted

## Context

Citizen complaints contain personally identifiable information (PII): names, street addresses, and phone numbers in the `reporter_contact` field. When using Groq or Google AI Studio (Gemini) for triage, data leaves our infrastructure and reaches a third-party server. On free tiers, providers may use inputs to improve their models.

## Decision

**Send only the complaint body (`text`) and `location` fields to the LLM. Never send `reporter_contact`.**

The LLM prompt template is:

```
You are a municipal complaint classifier. Classify the following complaint.

<complaint>
{text}
</complaint>
<location>{location}</location>

Respond with JSON only...
```

`reporter_contact` is stored in our database but is never included in the prompt.

## Rationale

- **Minimum necessary data.** The triage task only needs the complaint description and location to assign a category and priority. Contact details add no classification signal.
- **Reduced exposure.** If Groq's free tier uses inputs for model training, only the complaint text (which citizens wrote to report a public issue) is shared, not their phone number or email.
- **Prompt injection surface.** Including contact fields in the prompt enlarges the surface for injection attacks.

## Groq free tier terms (verified September 2026)

Groq's free developer tier does not charge per token and does not require a credit card. Rate limits apply per organisation per model. Groq's privacy policy should be reviewed before deploying with sensitive real-world data.

## Alternatives considered

- **Redact PII from complaint text before sending:** Would require a separate PII detection step, adding latency and complexity. The complaint text is already public-intent data (submitted to report a civic issue). Rejected as over-engineering for this context.
- **Use only Ollama (no data leaves the machine):** Zero PII exposure. Viable and loses no marks. We chose Groq as primary for speed and quality, with Ollama as an offline alternative.
- **Accept full data exposure:** Would require explicit consent from citizens and a privacy notice. Not implemented for this assignment context.

## Consequences

The `LLMTriage.triage()` method signature accepts `text: str, location: str` — it never receives `reporter_contact`. The service layer is responsible for passing only these two fields.
