from app.providers.triage.base import TriageProvider
from app.providers.triage.llm import LLMTriage
from app.providers.triage.ollama import OllamaTriage
from app.providers.triage.rules import RuleBasedTriage
from app.providers.triage.simulated import SimulatedTriage


def get_triage_provider() -> TriageProvider:
    from app.config import settings

    provider = settings.TRIAGE_PROVIDER.lower()
    if provider == "llm":
        return LLMTriage(api_key=settings.GROQ_API_KEY)
    if provider == "ollama":
        return OllamaTriage(base_url=settings.OLLAMA_BASE_URL, model=settings.OLLAMA_MODEL)
    if provider == "simulated":
        return SimulatedTriage()
    return RuleBasedTriage()
