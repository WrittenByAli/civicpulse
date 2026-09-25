from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass
class TriageResult:
    category: str
    priority: str
    ai_summary: str
    triaged_by: str
    latency_ms: int


@runtime_checkable
class TriageProvider(Protocol):
    async def triage(self, text: str, location: str) -> TriageResult: ...

    def name(self) -> str: ...
