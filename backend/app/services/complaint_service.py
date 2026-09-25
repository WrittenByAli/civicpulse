import hashlib
import json
import logging
import math
import uuid
from typing import Any

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Complaint, ComplaintStatus
from app.providers.triage import TriageProvider
from app.repositories import complaint_repo
from app.schemas import ComplaintListResponse, ComplaintResponse
from app.services.state_machine import assert_transition

logger = logging.getLogger(__name__)

_TRIAGE_CACHE_TTL = 86400  # 24 hours
_OUTCOME_STORE_KEY = "meta:outcomes"
_OUTCOME_MAX = 20


def _triage_cache_key(text: str, location: str) -> str:
    digest = hashlib.sha256(f"{text}{location}".encode()).hexdigest()
    return f"triage:{digest}"


async def create_complaint(
    db: AsyncSession,
    redis: Redis,
    provider: TriageProvider,
    *,
    text: str,
    location: str,
    reporter_contact: str | None,
) -> Complaint:
    cache_key = _triage_cache_key(text, location)
    cached_raw = await redis.get(cache_key)

    if cached_raw:
        cached = json.loads(cached_raw)
        category = cached["category"]
        priority = cached["priority"]
        ai_summary = cached["ai_summary"]
        triaged_by = cached["triaged_by"]
        triage_latency_ms = cached["latency_ms"]
        logger.info("Triage cache HIT for key %s", cache_key)
        complaint = await complaint_repo.create_complaint(
            db,
            text=text,
            location=location,
            reporter_contact=reporter_contact,
            category=category,
            priority=priority,
            ai_summary=ai_summary,
            triaged_by=triaged_by,
            triage_latency_ms=triage_latency_ms,
        )
        return complaint
    else:
        result = await provider.triage(text, location)
        category = result.category
        priority = result.priority
        ai_summary = result.ai_summary
        triaged_by = result.triaged_by
        triage_latency_ms = result.latency_ms

        await redis.setex(
            cache_key,
            _TRIAGE_CACHE_TTL,
            json.dumps({
                "category": category,
                "priority": priority,
                "ai_summary": ai_summary,
                "triaged_by": triaged_by,
                "latency_ms": triage_latency_ms,
                "is_fallback": result.is_fallback,
            }),
        )

        # Store provider, latency_ms, fallback y/n — the spec's observability surface
        outcome = {
            "triaged_by": triaged_by,
            "category": category,
            "priority": priority,
            "latency_ms": triage_latency_ms,
            "fallback": result.is_fallback,
        }
        await redis.lpush(_OUTCOME_STORE_KEY, json.dumps(outcome))
        await redis.ltrim(_OUTCOME_STORE_KEY, 0, _OUTCOME_MAX - 1)

    complaint = await complaint_repo.create_complaint(
        db,
        text=text,
        location=location,
        reporter_contact=reporter_contact,
        category=category,
        priority=priority,
        ai_summary=ai_summary,
        triaged_by=triaged_by,
        triage_latency_ms=triage_latency_ms,
    )
    return complaint


async def get_complaint(db: AsyncSession, complaint_id: uuid.UUID) -> Complaint | None:
    return await complaint_repo.get_complaint(db, complaint_id)


async def list_complaints(
    db: AsyncSession,
    *,
    page: int = 1,
    per_page: int = 20,
    status: str | None = None,
    category: str | None = None,
    priority: str | None = None,
) -> ComplaintListResponse:
    items, total = await complaint_repo.list_complaints(
        db, page=page, per_page=per_page, status=status, category=category, priority=priority
    )
    pages = math.ceil(total / per_page) if total else 0
    return ComplaintListResponse(
        items=[ComplaintResponse.model_validate(c) for c in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


async def update_status(
    db: AsyncSession,
    complaint_id: uuid.UUID,
    new_status: ComplaintStatus,
) -> Complaint:
    complaint = await complaint_repo.get_complaint(db, complaint_id)
    if complaint is None:
        raise LookupError(f"Complaint {complaint_id} not found")

    current = ComplaintStatus(complaint.status)
    assert_transition(current, new_status)

    updated = await complaint_repo.update_complaint_status(
        db, complaint_id, new_status.value,
    )
    assert updated is not None
    return updated


async def get_provider_meta(redis: Redis, active_provider: str) -> dict[str, Any]:
    raw_outcomes = await redis.lrange(_OUTCOME_STORE_KEY, 0, _OUTCOME_MAX - 1)
    outcomes = [json.loads(o) for o in raw_outcomes]
    return {"active_provider": active_provider, "last_outcomes": outcomes}
