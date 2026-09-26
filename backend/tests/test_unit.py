"""Direct unit tests — call functions without HTTP to avoid ASGI coverage blind spots."""
import uuid

import pytest

from app.auth import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.models import ComplaintStatus
from app.repositories import complaint_repo
from app.services import complaint_service


# ── app/auth.py ───────────────────────────────────────────────────────────────

def test_hash_password_produces_bcrypt_hash():
    assert hash_password("hunter2").startswith("$2b$")


def test_verify_password_correct_returns_true():
    hashed = hash_password("hunter2")
    assert verify_password("hunter2", hashed) is True


def test_verify_password_wrong_returns_false():
    hashed = hash_password("hunter2")
    assert verify_password("wrong", hashed) is False


def test_create_and_decode_token_roundtrip():
    uid = uuid.uuid4()
    token = create_access_token(uid, "operator")
    payload = decode_access_token(token)
    assert payload["sub"] == str(uid)
    assert payload["role"] == "operator"


# ── app/repositories/complaint_repo.py ────────────────────────────────────────

async def _make_complaint(db, **overrides):
    """Helper: insert a complaint directly via the repo."""
    defaults = dict(
        text="Direct test — water pipe burst on road causing flooding",
        location="Test Location, Lahore",
        reporter_contact=None,
        category="water",
        priority="normal",
        ai_summary="Water pipe burst",
        triaged_by="simulated",
        triage_latency_ms=30,
        ai_confidence=0.85,
    )
    defaults.update(overrides)
    return await complaint_repo.create_complaint(db, **defaults)


@pytest.mark.asyncio
async def test_create_complaint_directly(db_session):
    complaint = await _make_complaint(db_session)
    assert complaint.id is not None
    assert complaint.category == "water"
    assert complaint.status == "open"


@pytest.mark.asyncio
async def test_get_complaint_directly(db_session):
    created = await _make_complaint(db_session)
    fetched = await complaint_repo.get_complaint(db_session, created.id)
    assert fetched is not None
    assert fetched.id == created.id


@pytest.mark.asyncio
async def test_get_complaint_missing_returns_none(db_session):
    result = await complaint_repo.get_complaint(db_session, uuid.uuid4())
    assert result is None


@pytest.mark.asyncio
async def test_list_complaints_with_filters_directly(db_session):
    owner = uuid.uuid4()
    await _make_complaint(
        db_session,
        text="Electricity outage direct filter test text here",
        category="electricity",
        priority="high",
        owner_id=owner,
    )
    complaints, total = await complaint_repo.list_complaints(
        db_session,
        status="open",
        category="electricity",
        priority="high",
        owner_id=owner,
    )
    assert total >= 1
    assert all(c.category == "electricity" for c in complaints)


@pytest.mark.asyncio
async def test_update_complaint_status_directly(db_session):
    complaint = await _make_complaint(
        db_session,
        text="Road pothole direct status update test text here",
        category="roads",
    )
    updated = await complaint_repo.update_complaint_status(
        db_session, complaint.id, "in_progress"
    )
    assert updated is not None
    assert updated.status == "in_progress"


@pytest.mark.asyncio
async def test_get_stats_on_empty_db(db_session):
    stats = await complaint_repo.get_stats(db_session)
    assert "total" in stats
    assert "open" in stats["by_status"]
    assert "water" in stats["by_category"]
    assert "high" in stats["by_priority"]


# ── app/services/complaint_service.py ────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_complaints_service_empty(db_session):
    result = await complaint_service.list_complaints(db_session, page=1, per_page=10)
    assert result.total >= 0
    assert isinstance(result.items, list)


@pytest.mark.asyncio
async def test_update_status_service_not_found(db_session):
    with pytest.raises(LookupError):
        await complaint_service.update_status(
            db_session, uuid.uuid4(), ComplaintStatus.IN_PROGRESS
        )


@pytest.mark.asyncio
async def test_update_status_service_success(db_session):
    complaint = await _make_complaint(
        db_session,
        text="Sanitation issue direct service update test text here",
        category="sanitation",
    )
    updated = await complaint_service.update_status(
        db_session, complaint.id, ComplaintStatus.IN_PROGRESS
    )
    assert updated.status == "in_progress"
