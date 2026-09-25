# ADR 0001 — TriageProvider Interface Design

**Date:** 2026-09-25
**Status:** Accepted

## Context

The triage component must support multiple backends (hosted LLM, local Ollama, keyword rules, CI fake) that can be swapped via environment variable. We need a contract that all implementations satisfy without coupling the service layer to any concrete class.

## Decision

Use Python's `typing.Protocol` (structural subtyping) rather than an abstract base class.

```python
class TriageProvider(Protocol):
    name: str
    def triage(self, text: str, location: str) -> TriageResult: ...
```

## Rationale

- **No inheritance required.** Any class with the right signature satisfies the Protocol. This means `RuleBasedTriage` and `SimulatedTriage` can be in separate files with zero coupling to a base class.
- **Testable in isolation.** Any object with a `triage` method can be injected; tests don't need to import the real implementations.
- **mypy enforces the contract.** `isinstance()` checks against a Protocol at runtime require `runtime_checkable`; mypy catches violations at type-check time instead.

## Alternatives considered

- **Abstract base class (`abc.ABC`):** Would require all implementations to inherit from it, creating a coupling that complicates testing and makes the pattern harder to explain. Rejected.
- **Duck typing with no protocol:** No static enforcement; mypy cannot catch a missing method until runtime. Rejected.

## Consequences

All four implementations (`LLMTriage`, `OllamaTriage`, `RuleBasedTriage`, `SimulatedTriage`) must match the Protocol signature exactly. mypy will catch deviations in CI.
