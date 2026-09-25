import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_redis, get_triage_provider
from app.models import ComplaintCategory, ComplaintPriority, ComplaintStatus
from app.providers.triage import TriageProvider
from app.schemas import (
    ComplaintCreate,
    ComplaintListResponse,
    ComplaintResponse,
    StatusUpdate,
)
from app.services import complaint_service
from app.services.state_machine import InvalidTransitionError

router = APIRouter(prefix="/api/complaints", tags=["complaints"])
logger = logging.getLogger(__name__)


@router.post("", response_model=ComplaintResponse, status_code=status.HTTP_201_CREATED)
async def submit_complaint(
    payload: ComplaintCreate,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    provider: TriageProvider = Depends(get_triage_provider),
) -> ComplaintResponse:
    complaint = await complaint_service.create_complaint(
        db,
        redis,
        provider,
        text=payload.text,
        location=payload.location,
        reporter_contact=payload.reporter_contact,
    )
    return ComplaintResponse.model_validate(complaint)


@router.get("/{complaint_id}", response_model=ComplaintResponse)
async def get_complaint(
    complaint_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ComplaintResponse:
    complaint = await complaint_service.get_complaint(db, complaint_id)
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return ComplaintResponse.model_validate(complaint)


@router.get("", response_model=ComplaintListResponse)
async def list_complaints(
    page: int = 1,
    per_page: int = 20,
    status: ComplaintStatus | None = None,
    category: ComplaintCategory | None = None,
    priority: ComplaintPriority | None = None,
    db: AsyncSession = Depends(get_db),
) -> ComplaintListResponse:
    if page < 1:
        raise HTTPException(status_code=422, detail="page must be >= 1")
    if per_page < 1 or per_page > 100:
        raise HTTPException(status_code=422, detail="per_page must be 1-100")
    return await complaint_service.list_complaints(
        db,
        page=page,
        per_page=per_page,
        status=status.value if status else None,
        category=category.value if category else None,
        priority=priority.value if priority else None,
    )


@router.patch("/{complaint_id}/status", response_model=ComplaintResponse)
async def update_status(
    complaint_id: uuid.UUID,
    payload: StatusUpdate,
    db: AsyncSession = Depends(get_db),
) -> ComplaintResponse:
    try:
        complaint = await complaint_service.update_status(db, complaint_id, payload.status)
    except LookupError:
        raise HTTPException(
            status_code=404, detail="Complaint not found",
        ) from None
    except InvalidTransitionError as exc:
        raise HTTPException(
            status_code=409, detail=str(exc),
        ) from exc
    return ComplaintResponse.model_validate(complaint)
