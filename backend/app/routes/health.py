import logging

from fastapi import APIRouter, Depends, Response, status
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_redis

router = APIRouter(tags=["ops"])
logger = logging.getLogger(__name__)


@router.get("/health", status_code=200)
async def liveness() -> dict:
    """Liveness probe — no DB or cache check. Returns 200 if the process is alive."""
    return {"status": "ok"}


@router.get("/ready", status_code=200)
async def readiness(
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> dict:
    """Readiness probe — checks Postgres and Redis connectivity."""
    checks: dict[str, str] = {}
    ok = True

    try:
        await db.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as exc:
        logger.error("Readiness check: postgres failed: %s", exc)
        checks["postgres"] = "error"
        ok = False

    try:
        await redis.ping()
        checks["redis"] = "ok"
    except Exception as exc:
        logger.error("Readiness check: redis failed: %s", exc)
        checks["redis"] = "error"
        ok = False

    if not ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {"status": "ok" if ok else "degraded", "checks": checks}
