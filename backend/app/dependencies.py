"""FastAPI dependency functions for shared resources."""
import uuid
from collections.abc import AsyncGenerator
from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import decode_access_token
from app.config import settings
from app.database import get_db
from app.models import User, UserRole
from app.providers.triage import TriageProvider
from app.providers.triage import get_triage_provider as _factory

_bearer = HTTPBearer(auto_error=False)


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


async def _get_user_from_token(
    credentials: HTTPAuthorizationCredentials | None,
    db: AsyncSession,
) -> User | None:
    if credentials is None:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await _get_user_from_token(credentials, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    return await _get_user_from_token(credentials, db)


def require_operator(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.OPERATOR.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operators only")
    return user
