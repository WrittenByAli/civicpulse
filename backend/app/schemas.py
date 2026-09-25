import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import ComplaintCategory, ComplaintPriority, ComplaintStatus


class ComplaintCreate(BaseModel):
    text: str = Field(min_length=10, max_length=2000)
    location: str = Field(min_length=3, max_length=200)
    reporter_contact: str | None = Field(None, max_length=200)


class StatusUpdate(BaseModel):
    status: ComplaintStatus


class ComplaintResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    text: str
    location: str
    reporter_contact: str | None
    category: ComplaintCategory
    priority: ComplaintPriority
    status: ComplaintStatus
    ai_summary: str | None
    triaged_by: str | None
    triage_latency_ms: int | None
    created_at: datetime
    updated_at: datetime


class ComplaintListResponse(BaseModel):
    items: list[ComplaintResponse]
    total: int
    page: int
    per_page: int
    pages: int


class StatsResponse(BaseModel):
    total: int
    by_status: dict[str, int]
    by_category: dict[str, int]
    by_priority: dict[str, int]


class ProviderMetaResponse(BaseModel):
    active_provider: str
    last_outcomes: list[dict]
