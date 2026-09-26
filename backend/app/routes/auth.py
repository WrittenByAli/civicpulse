"""Authentication endpoints with email OTP verification and brute-force protection."""
import json
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token, hash_password, verify_password
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, get_redis
from app.email_service import send_otp_email
from app.models import User, UserRole
from app.schemas import (
    LoginRequest,
    ResendCodeRequest,
    SignupPendingResponse,
    SignupRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)

# ── Redis key helpers ──────────────────────────────────────────────────────────

def _otp_key(email: str) -> str:
    return f"cp:otp:{email}"

def _otp_attempts_key(email: str) -> str:
    return f"cp:otp_attempts:{email}"

def _otp_resend_cooldown_key(email: str) -> str:
    return f"cp:otp_resend:{email}"

def _pending_key(email: str) -> str:
    return f"cp:pending:{email}"

def _login_fail_key(email: str) -> str:
    return f"cp:login_fail:{email}"


def _generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


async def _store_pending_and_send(
    redis: Redis, email: str, full_name: str, hashed_pw: str, role: str
) -> None:
    otp = _generate_otp()
    ttl = settings.OTP_TTL_SECONDS

    pipe = redis.pipeline()
    pipe.set(_otp_key(email), otp, ex=ttl)
    pipe.delete(_otp_attempts_key(email))
    pipe.set(
        _pending_key(email),
        json.dumps({"full_name": full_name, "hashed_password": hashed_pw, "role": role}),
        ex=ttl,
    )
    await pipe.execute()

    await send_otp_email(email, full_name, otp)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/signup",
    response_model=SignupPendingResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def signup(
    payload: SignupRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> SignupPendingResponse:
    """Validate, send OTP — does NOT create the account yet."""
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=422, detail="Passwords do not match")

    email = payload.email.lower()

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Also reject if a pending (unverified) signup exists for this email
    if await redis.exists(_pending_key(email)):
        raise HTTPException(
            status_code=409,
            detail="A verification code was already sent to this email. "
                   "Check your inbox or wait for it to expire.",
        )

    hashed_pw = hash_password(payload.password)
    await _store_pending_and_send(redis, email, payload.full_name, hashed_pw, payload.role.value)

    # Set initial resend cooldown so user can't spam immediately after signup
    await redis.set(
        _otp_resend_cooldown_key(email), "1", ex=settings.OTP_RESEND_COOLDOWN_SECONDS
    )

    return SignupPendingResponse(
        message=f"Verification code sent to {email}. It expires in 10 minutes."
    )


@router.post("/verify-email", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def verify_email(
    payload: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> TokenResponse:
    """Verify OTP → create account → return JWT."""
    email = payload.email.lower()

    # Guard: too many wrong attempts
    attempts_raw = await redis.get(_otp_attempts_key(email))
    attempts = int(attempts_raw) if attempts_raw else 0
    if attempts >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many incorrect attempts. Request a new code.",
        )

    stored_otp = await redis.get(_otp_key(email))
    if stored_otp is None:
        raise HTTPException(
            status_code=400,
            detail="No pending verification for this email or code has expired.",
        )

    if not secrets.compare_digest(stored_otp, payload.otp):
        new_attempts = await redis.incr(_otp_attempts_key(email))
        ttl = await redis.ttl(_otp_key(email))
        if ttl > 0:
            await redis.expire(_otp_attempts_key(email), ttl)
        remaining = settings.OTP_MAX_ATTEMPTS - new_attempts
        raise HTTPException(
            status_code=400,
            detail=f"Invalid code. {remaining} attempt(s) remaining." if remaining > 0
                   else "Too many incorrect attempts. Request a new code.",
        )

    # Retrieve pending user data
    pending_raw = await redis.get(_pending_key(email))
    if pending_raw is None:
        raise HTTPException(status_code=400, detail="Signup session expired. Please sign up again.")
    pending = json.loads(pending_raw)

    # Double-check email not registered in the time between signup and verify
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=email,
        full_name=pending["full_name"],
        hashed_password=pending["hashed_password"],
        role=pending["role"],
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Invalidate all OTP keys for this email
    pipe = redis.pipeline()
    pipe.delete(_otp_key(email))
    pipe.delete(_otp_attempts_key(email))
    pipe.delete(_pending_key(email))
    pipe.delete(_otp_resend_cooldown_key(email))
    await pipe.execute()

    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token)


@router.post("/resend-code", status_code=status.HTTP_202_ACCEPTED)
async def resend_code(
    payload: ResendCodeRequest,
    redis: Redis = Depends(get_redis),
) -> dict:
    """Resend OTP with cooldown protection."""
    email = payload.email.lower()

    # Cooldown check
    if await redis.exists(_otp_resend_cooldown_key(email)):
        ttl = await redis.ttl(_otp_resend_cooldown_key(email))
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {ttl} second(s) before requesting a new code.",
        )

    pending_raw = await redis.get(_pending_key(email))
    if pending_raw is None:
        raise HTTPException(
            status_code=400,
            detail="No pending signup for this email. Please sign up again.",
        )
    pending = json.loads(pending_raw)

    otp = _generate_otp()
    ttl = settings.OTP_TTL_SECONDS

    pipe = redis.pipeline()
    pipe.set(_otp_key(email), otp, ex=ttl)
    pipe.delete(_otp_attempts_key(email))
    pipe.expire(_pending_key(email), ttl)
    pipe.set(_otp_resend_cooldown_key(email), "1", ex=settings.OTP_RESEND_COOLDOWN_SECONDS)
    await pipe.execute()

    await send_otp_email(email, pending.get("full_name", ""), otp)

    return {"message": "Verification code resent."}


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> TokenResponse:
    email = payload.email.lower()
    fail_key = _login_fail_key(email)

    # Brute-force lockout
    fail_count_raw = await redis.get(fail_key)
    if fail_count_raw and int(fail_count_raw) >= settings.LOGIN_MAX_FAILURES:
        raise HTTPException(
            status_code=429,
            detail="Too many failed attempts. Try again in 15 minutes.",
        )

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        # Check whether this email has a pending (unverified) signup in Redis
        pending_exists = await redis.exists(_pending_key(email))
        if pending_exists:
            raise HTTPException(
                status_code=403,
                detail="Email not verified. Check your inbox or request a new code.",
                headers={"X-Unverified-Email": email},
            )
        # Generic error — don't reveal whether the email exists
        pipe = redis.pipeline()
        pipe.incr(fail_key)
        pipe.expire(fail_key, settings.LOGIN_LOCKOUT_SECONDS)
        await pipe.execute()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(payload.password, user.hashed_password):
        pipe = redis.pipeline()
        pipe.incr(fail_key)
        pipe.expire(fail_key, settings.LOGIN_LOCKOUT_SECONDS)
        await pipe.execute()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Email not verified. Check your inbox or request a new code.",
            headers={"X-Unverified-Email": email},
        )

    # Successful login — clear failure counter
    await redis.delete(fail_key)

    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(user)
