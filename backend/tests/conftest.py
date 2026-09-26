"""Test fixtures — SQLite in-memory DB, TRIAGE_PROVIDER=simulated, auth mocked."""
import os
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ.setdefault("TRIAGE_PROVIDER", "simulated")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

_engine = create_async_engine(TEST_DB_URL, echo=False)
_SessionLocal = async_sessionmaker(_engine, expire_on_commit=False)


def _mock_operator():
    user = MagicMock()
    user.id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    user.email = "operator@test.example"
    user.full_name = "Test Operator"
    user.role = "operator"
    user.is_verified = True
    return user


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_tables():
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    async with _SessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session):
    """HTTP test client with DB, Redis, and auth overridden."""
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.set.return_value = True
    mock_redis.setex.return_value = True
    mock_redis.incr.return_value = 1
    mock_redis.expire.return_value = True
    mock_redis.ping.return_value = True
    mock_redis.lpush.return_value = 1
    mock_redis.ltrim.return_value = True
    mock_redis.lrange.return_value = []
    mock_redis.aclose = AsyncMock()

    operator = _mock_operator()

    async def _override_db():
        yield db_session

    async def _override_redis():
        yield mock_redis

    async def _override_optional_user():
        return operator

    async def _override_current_user():
        return operator

    def _override_require_operator():
        return operator

    from app.dependencies import get_current_user, get_optional_user, get_redis, require_operator

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_redis] = _override_redis
    app.dependency_overrides[get_optional_user] = _override_optional_user
    app.dependency_overrides[get_current_user] = _override_current_user
    app.dependency_overrides[require_operator] = _override_require_operator

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
