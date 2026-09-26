"""Authentication endpoints with OTP verification, brute-force protection,
and operator-approval workflow."""
import json
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token, hash_password, verify_password
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, get_redis
from app.email_service import (
    send_operator_approved_email,
    send_operator_rejected_email,
    send_operator_request_email,
    send_otp_email,
)
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

def _op_request_key(token: str) -> str:
    return f"cp:op_request:{token}"


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
    """Validate + send OTP. Does NOT create the account yet."""
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=422, detail="Passwords do not match")

    email = payload.email.lower()

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    if await redis.exists(_pending_key(email)):
        raise HTTPException(
            status_code=409,
            detail="A verification code was already sent to this email. "
                   "Check your inbox or wait for it to expire.",
        )

    hashed_pw = hash_password(payload.password)
    await _store_pending_and_send(redis, email, payload.full_name, hashed_pw, payload.role.value)

    # Initial resend cooldown
    await redis.set(_otp_resend_cooldown_key(email), "1", ex=settings.OTP_RESEND_COOLDOWN_SECONDS)

    return SignupPendingResponse(
        message=f"Verification code sent to {email}. It expires in 10 minutes."
    )


@router.post("/verify-email", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def verify_email(
    payload: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> TokenResponse:
    """Verify OTP → create account → return JWT.

    If the user requested the operator role, account is created as citizen and
    an approval request email is sent to the main operator.
    """
    email = payload.email.lower()

    attempts_raw = await redis.get(_otp_attempts_key(email))
    attempts = int(attempts_raw) if attempts_raw else 0
    if attempts >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429, detail="Too many incorrect attempts. Request a new code."
        )

    stored_otp = await redis.get(_otp_key(email))
    if stored_otp is None:
        raise HTTPException(
            status_code=400,
            detail="No pending verification for this email or code has expired.",
        )

    if not secrets.compare_digest(str(stored_otp), payload.otp):
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

    pending_raw = await redis.get(_pending_key(email))
    if pending_raw is None:
        raise HTTPException(status_code=400, detail="Signup session expired. Please sign up again.")
    pending = json.loads(pending_raw)

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Always create as citizen — operator access is granted separately via approval
    requested_role = pending["role"]
    create_as_role = UserRole.CITIZEN.value

    user = User(
        email=email,
        full_name=pending["full_name"],
        hashed_password=pending["hashed_password"],
        role=create_as_role,
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Invalidate OTP keys
    pipe = redis.pipeline()
    pipe.delete(_otp_key(email))
    pipe.delete(_otp_attempts_key(email))
    pipe.delete(_pending_key(email))
    pipe.delete(_otp_resend_cooldown_key(email))
    await pipe.execute()

    # If operator was requested, store an approval token and email the main operator
    operator_approval_pending = False
    if requested_role == UserRole.OPERATOR.value:
        operator_approval_pending = True
        approval_token = secrets.token_urlsafe(32)
        reject_token = secrets.token_urlsafe(32)
        ttl = settings.OPERATOR_REQUEST_TTL_SECONDS

        pipe = redis.pipeline()
        pipe.set(
            _op_request_key(approval_token),
            json.dumps({
                "user_id": str(user.id),
                "email": email,
                "full_name": pending["full_name"],
                "action": "approve",
            }),
            ex=ttl,
        )
        pipe.set(
            _op_request_key(reject_token),
            json.dumps({
                "user_id": str(user.id),
                "email": email,
                "full_name": pending["full_name"],
                "action": "reject",
            }),
            ex=ttl,
        )
        await pipe.execute()

        base = settings.FRONTEND_URL
        await send_operator_request_email(
            requester_name=pending["full_name"],
            requester_email=email,
            approve_url=f"{base}/api/auth/operator-request/{approval_token}",
            reject_url=f"{base}/api/auth/operator-request/{reject_token}",
        )

    token = create_access_token(user.id, user.role)
    resp = TokenResponse(access_token=token)

    # Attach a hint so the frontend can show the right message
    if operator_approval_pending:
        # Embed as custom header; frontend reads it
        pass  # TokenResponse itself carries the JWT; page reads user.role == 'citizen'

    return resp


@router.get("/operator-request/{token}", include_in_schema=False)
async def handle_operator_request(
    token: str,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> Response:
    """One-click approve/reject link from the operator approval email."""
    raw = await redis.get(_op_request_key(token))
    if raw is None:
        return Response(
            content=_result_page(
                "Link expired or already used",
                "This approval link has already been used or has expired.",
                error=True,
            ),
            media_type="text/html",
        )

    data = json.loads(raw)
    await redis.delete(_op_request_key(token))

    result = await db.execute(select(User).where(User.id == data["user_id"]))
    user = result.scalar_one_or_none()
    if user is None:
        return Response(
            content=_result_page("User not found", "The account no longer exists.", error=True),
            media_type="text/html",
        )

    action = data.get("action", "approve")

    if action == "approve":
        user.role = UserRole.OPERATOR.value
        await db.flush()
        await send_operator_approved_email(user.email, user.full_name or "")
        return Response(
            content=_result_page(
                "Operator access granted",
                f"{data['full_name']} ({data['email']}) has been upgraded to operator.",
            ),
            media_type="text/html",
        )
    else:
        await send_operator_rejected_email(user.email, user.full_name or "")
        return Response(
            content=_result_page(
                "Request rejected",
                f"{data['full_name']} ({data['email']}) has been notified "
                "that their request was declined.",
                warning=True,
            ),
            media_type="text/html",
        )


def _result_page(title: str, message: str, error: bool = False, warning: bool = False) -> str:
    color = "#dc2626" if error else "#f59e0b" if warning else "#16a34a"
    return f"""<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"><title>CivicPulse — {title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{{box-sizing:border-box}}body{{margin:0;min-height:100vh;display:flex;align-items:center;
justify-content:center;background:#09090b;font-family:system-ui,sans-serif;padding:24px}}
.card{{background:#111113;border:1px solid rgba(255,255,255,.08);border-radius:12px;
padding:32px 36px;max-width:420px;width:100%;text-align:center}}
.dot{{width:48px;height:48px;border-radius:50%;background:{color}22;
display:flex;align-items:center;justify-content:center;margin:0 auto 20px}}
h1{{color:#f4f4f5;font-size:18px;margin:0 0 10px}}p{{color:#71717a;font-size:14px;margin:0 0 24px}}
a{{display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px}}</style>
</head><body><div class="card">
<div class="dot"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"
stroke="{color}" stroke-width="2.5">
{"<path d='M18 6L6 18M6 6l12 12'/>" if error else "<path d='M20 6L9 17l-5-5'/>"}</svg></div>
<h1>{title}</h1><p>{message}</p>
<a href="{settings.FRONTEND_URL}">Go to CivicPulse</a>
</div></body></html>"""


@router.post("/resend-code", status_code=status.HTTP_202_ACCEPTED)
async def resend_code(
    payload: ResendCodeRequest,
    redis: Redis = Depends(get_redis),
) -> dict:
    email = payload.email.lower()

    if await redis.exists(_otp_resend_cooldown_key(email)):
        ttl = await redis.ttl(_otp_resend_cooldown_key(email))
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {ttl} second(s) before requesting a new code.",
        )

    pending_raw = await redis.get(_pending_key(email))
    if pending_raw is None:
        raise HTTPException(
            status_code=400, detail="No pending signup for this email. Please sign up again."
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

    fail_count_raw = await redis.get(fail_key)
    if fail_count_raw and int(fail_count_raw) >= settings.LOGIN_MAX_FAILURES:
        raise HTTPException(
            status_code=429, detail="Too many failed attempts. Try again in 15 minutes."
        )

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        if await redis.exists(_pending_key(email)):
            raise HTTPException(
                status_code=403,
                detail="Email not verified. Check your inbox or request a new code.",
                headers={"X-Unverified-Email": email},
            )
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

    await redis.delete(fail_key)
    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(user)
