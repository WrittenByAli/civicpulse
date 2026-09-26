"""Custom Prometheus metrics for triage observability."""
from prometheus_client import Counter, Histogram

triage_latency = Histogram(
    "civicpulse_triage_latency_seconds",
    "Time spent in triage provider (seconds)",
    ["provider"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0),
)

fallback_counter = Counter(
    "civicpulse_triage_fallbacks_total",
    "Number of times the LLM provider fell back to rule-based triage",
    ["original_provider"],
)
