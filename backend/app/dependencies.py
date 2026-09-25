"""FastAPI dependency functions for shared resources."""
from collections.abc import AsyncGenerator
from functools import lru_cache

from redis.asyncio import Redis

from app.config import settings
from app.providers.triage import TriageProvider, get_triage_provider as _factory


@lru_cache(maxsize=1)
def _get_provider_singleton() -> TriageProvider:
    return _factory()


def get_triage_provider() -> TriageProvider:
    return _get_provider_singleton()


async def get_redis() -> AsyncGenerator[Redis, None]:
    client: Redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()
