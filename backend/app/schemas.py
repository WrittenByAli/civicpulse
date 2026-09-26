import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models import ComplaintCategory, ComplaintPriority, ComplaintStatus, UserRole


class SignupRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.CITIZEN

    @model_validator(mode="after")
    def passwords_match(self) -> "SignupRequest":
        if self.password != self.confirm_password:
            raise ValueError("passwords do not match")
        return self


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResendCodeRequest(BaseModel):
    email: EmailStr


class SignupPendingResponse(BaseModel):
    pending: bool = True
    message: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    full_name: str | None
    role: str
    is_verified: bool
    created_at: datetime


_PHONE_RE = re.compile(r"^[+\d][\d\s\-().]{5,49}$")


class ComplaintCreate(BaseModel):
    text: str = Field(min_length=10, max_length=2000)
    location: str = Field(min_length=3, max_length=200)
    reporter_contact: str | None = Field(None, max_length=50)

    @field_validator("text", "location", mode="before")
    @classmethod
    def strip_and_no_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("field must not be blank or whitespace only")
        return v

    @field_validator("reporter_contact", mode="before")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        v = v.strip()
        if not _PHONE_RE.match(v):
            raise ValueError("reporter_contact must be a valid phone number")
        return v


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
    ai_confidence: float | None
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
    cache_hit_rate: float | None = None
    cache_hits: int = 0
    cache_misses: int = 0
