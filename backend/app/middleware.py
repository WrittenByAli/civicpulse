"""Request-ID injection and rate limiting middleware."""
import logging
import uuid

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.logging_config import request_id_var

logger = logging.getLogger(__name__)


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        req_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        token = request_id_var.set(req_id)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = req_id
            return response
        finally:
            request_id_var.reset(token)


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # Only rate-limit mutation endpoints
        if request.method not in ("POST", "PATCH", "PUT", "DELETE"):
            return await call_next(request)
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        redis_url = settings.REDIS_URL
        key = f"rate:{client_ip}"
        try:
            redis = Redis.from_url(redis_url, decode_responses=True)
            try:
                count = await redis.incr(key)
                if count == 1:
                    await redis.expire(
                        key, settings.RATE_LIMIT_WINDOW_SECONDS,
                    )
                if count > settings.RATE_LIMIT_REQUESTS:
                    return JSONResponse(
                        status_code=429,
                        content={
                            "detail": "Rate limit exceeded. Try again later.",
                        },
                        headers={
                            "Retry-After": str(
                                settings.RATE_LIMIT_WINDOW_SECONDS,
                            ),
                        },
                    )
            finally:
                await redis.aclose()
        except Exception:  # noqa: BLE001
            logger.debug("Rate limiter skipped — Redis unavailable")

        return await call_next(request)
