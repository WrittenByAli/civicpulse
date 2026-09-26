import json
import logging

from fastapi import APIRouter, Depends, Response
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_redis
from app.repositories import complaint_repo
from app.schemas import StatsResponse

router = APIRouter(prefix="/api/stats", tags=["stats"])
logger = logging.getLogger(__name__)

_STATS_CACHE_KEY = "stats:global"
_STATS_CACHE_TTL = 30  # seconds


@router.get("", response_model=StatsResponse)
async def get_stats(
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> StatsResponse:
    cached = await redis.get(_STATS_CACHE_KEY)
    if cached:
        response.headers["X-Cache"] = "HIT"
        return StatsResponse(**json.loads(cached))

    stats = await complaint_repo.get_stats(db)
    await redis.setex(_STATS_CACHE_KEY, _STATS_CACHE_TTL, json.dumps(stats))
    response.headers["X-Cache"] = "MISS"
    return StatsResponse(**stats)
