from fastapi import APIRouter, Depends
from redis.asyncio import Redis

from app.dependencies import get_redis, get_triage_provider
from app.providers.triage import TriageProvider
from app.schemas import ProviderMetaResponse
from app.services import complaint_service

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/providers", response_model=ProviderMetaResponse)
async def get_provider_meta(
    redis: Redis = Depends(get_redis),
    provider: TriageProvider = Depends(get_triage_provider),
) -> ProviderMetaResponse:
    meta = await complaint_service.get_provider_meta(redis, provider.name())
    return ProviderMetaResponse(**meta)
