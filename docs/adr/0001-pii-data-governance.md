# ADR 0001 — PII and Data-Governance for the AI Triage Layer

**Status:** Accepted  
**Date:** 2026-09-26  
**Context:** CS4032 SCD Assignment 1 — CivicPulse municipal complaint platform

---

## Context

Citizens submit free-text complaints that may contain Personally Identifiable Information (PII): names, phone numbers, addresses, and account references. The complaint text is sent to an external Large Language Model (Groq API) or a local model (Ollama) for triage. This ADR records what PII enters the AI layer, what controls exist, and what residual risks are accepted.

---

## Decision

### 1. What reaches the LLM

The AI triage call receives two fields:

| Field | Content | PII risk |
|---|---|---|
| `text` | Raw complaint as typed by the citizen | High — may contain names, addresses, phone numbers |
| `location` | Neighbourhood or address entered by citizen | Medium — could identify a household |

The optional `reporter_contact` field (phone/email) is **never** sent to the LLM. It is stored only in PostgreSQL.

### 2. Prompt-injection guardrail

Complaint text is treated as **untrusted data**, not as instructions. It is injected between XML delimiters (`<complaint>…</complaint>`) and the system prompt instructs the model that those tags mark user-supplied content. The model is constrained to return only `category`, `priority`, `summary`, and `confidence`; it cannot act on embedded instructions such as "ignore previous instructions."

The Pydantic validation layer (`_TriageOutput`) rejects any response that does not conform to the allowed enum values, preventing a manipulated model output from reaching the database.

### 3. Data minimisation in the AI summary

The LLM is instructed to produce a **one-sentence operational summary** (≤140 characters). The prompt does not ask it to repeat names or contact details. If a citizen writes "Ali Hassan at 0300-1234567 reports…", the model should summarise the issue, not the identity. Enforcement is by prompt instruction; output is reviewed by the operator before action.

### 4. Caching

Triage results are cached in Redis for **24 hours** keyed by a SHA-256 hash of `(text, location)`. A cache hit means the complaint text is not re-sent to the external LLM. If a citizen submits an identical complaint twice, the second submission does not create a new AI call, reducing unnecessary external data transmission.

### 5. Residual risks and mitigations

| Risk | Mitigation |
|---|---|
| Groq (external API) stores prompt data | Use Ollama (`TRIAGE_PROVIDER=ollama`) for air-gapped or sensitive deployments |
| Redis cache contains complaint text hash | SHA-256 hash is one-way; text is not stored in the cache, only the triage result |
| PII in `ai_summary` written by LLM | Operators review before action; summary field limited to 140 chars |
| Sensitive complaints logged at INFO level | Log level should be raised to WARNING in production; complaint text should not be logged |

### 6. Offline fallback

If the external LLM is unavailable, the `RuleBasedTriage` provider classifies the complaint locally using keyword matching. No PII leaves the deployment boundary in this path.

---

## Consequences

- `reporter_contact` must never be included in the triage prompt template (enforced by code — only `text` and `location` are passed to `provider.triage()`).
- Any future triage provider must document whether it sends data to an external service.
- A production deployment handling real citizen data should prefer `TRIAGE_PROVIDER=ollama` with a local model to avoid external transmission entirely.
