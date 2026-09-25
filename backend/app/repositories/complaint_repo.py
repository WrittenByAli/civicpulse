"""All SQL lives here — zero query logic in routes or services."""
import math
import uuid
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Complaint, ComplaintCategory, ComplaintPriority, ComplaintStatus


async def create_complaint(
    db: AsyncSession,
    *,
    text: str,
    location: str,
    reporter_contact: str | None,
    category: str,
    priority: str,
    ai_summary: str | None,
    triaged_by: str | None,
    triage_latency_ms: int | None,
) -> Complaint:
    complaint = Complaint(
        text=text,
        location=location,
        reporter_contact=reporter_contact,
        category=category,
        priority=priority,
        status=ComplaintStatus.OPEN.value,
        ai_summary=ai_summary,
        triaged_by=triaged_by,
        triage_latency_ms=triage_latency_ms,
    )
    db.add(complaint)
    await db.flush()
    await db.refresh(complaint)
    return complaint


async def get_complaint(db: AsyncSession, complaint_id: uuid.UUID) -> Complaint | None:
    result = await db.execute(select(Complaint).where(Complaint.id == complaint_id))
    return result.scalar_one_or_none()


async def list_complaints(
    db: AsyncSession,
    *,
    page: int = 1,
    per_page: int = 20,
    status: str | None = None,
    category: str | None = None,
    priority: str | None = None,
) -> tuple[list[Complaint], int]:
    query = select(Complaint)
    if status:
        query = query.where(Complaint.status == status)
    if category:
        query = query.where(Complaint.category == category)
    if priority:
        query = query.where(Complaint.priority == priority)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.order_by(Complaint.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def update_complaint_status(
    db: AsyncSession,
    complaint_id: uuid.UUID,
    new_status: str,
) -> Complaint | None:
    await db.execute(
        update(Complaint)
        .where(Complaint.id == complaint_id)
        .values(status=new_status, updated_at=func.now())
    )
    await db.flush()
    return await get_complaint(db, complaint_id)


async def get_stats(db: AsyncSession) -> dict[str, Any]:
    total_result = await db.execute(select(func.count()).select_from(Complaint))
    total = total_result.scalar_one()

    by_status: dict[str, int] = {s.value: 0 for s in ComplaintStatus}
    status_rows = await db.execute(
        select(Complaint.status, func.count()).group_by(Complaint.status)
    )
    for row in status_rows:
        by_status[row[0]] = row[1]

    by_category: dict[str, int] = {c.value: 0 for c in ComplaintCategory}
    cat_rows = await db.execute(
        select(Complaint.category, func.count()).group_by(Complaint.category)
    )
    for row in cat_rows:
        by_category[row[0]] = row[1]

    by_priority: dict[str, int] = {p.value: 0 for p in ComplaintPriority}
    pri_rows = await db.execute(
        select(Complaint.priority, func.count()).group_by(Complaint.priority)
    )
    for row in pri_rows:
        by_priority[row[0]] = row[1]

    return {
        "total": total,
        "by_status": by_status,
        "by_category": by_category,
        "by_priority": by_priority,
    }
