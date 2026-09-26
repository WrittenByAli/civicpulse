"""Transactional email — SMTP first, Resend fallback, console last.

Priority:
  1. Gmail SMTP (SMTP_HOST + SMTP_USER + SMTP_PASS set) — any recipient
  2. Resend REST API (RESEND_API_KEY set)  — free tier: owner email only
  3. Console log (dev fallback)
"""
import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ── Shared layout wrapper ─────────────────────────────────────────────────────

def _wrap(body_html: str) -> str:
    return f"""\
<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 16px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#111113;border:1px solid rgba(255,255,255,0.08);
                    border-radius:12px;padding:32px 36px">
        <tr>
          <td style="padding-bottom:24px;border-bottom:1px solid rgba(255,255,255,0.06)">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="background:linear-gradient(135deg,#3b82f6,#2563eb);
                         border-radius:8px;width:28px;height:28px;
                         text-align:center;vertical-align:middle">
                <span style="color:#fff;font-weight:700;font-size:14px">C</span>
              </td>
              <td style="padding-left:10px;color:#f4f4f5;font-size:15px;font-weight:600">
                CivicPulse
              </td>
            </tr></table>
          </td>
        </tr>
        <tr><td style="padding-top:24px">{body_html}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def _smtp_send_sync(to: str, subject: str, html: str) -> None:
    """Blocking SMTP send — run inside a thread via asyncio.to_thread."""
    from_addr = settings.SMTP_FROM or settings.SMTP_USER
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(settings.SMTP_USER, settings.SMTP_PASS)
        server.sendmail(from_addr, [to], msg.as_string())


async def _send(to: str, subject: str, html: str) -> None:
    # ── 1. SMTP (Gmail App Password — works for any recipient) ───────────────
    if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASS:
        try:
            await asyncio.to_thread(_smtp_send_sync, to, subject, html)
            logger.info("[EMAIL] SMTP delivery OK → %s", to)
            return
        except Exception as exc:
            logger.error("[EMAIL] SMTP failed (%s) — falling back to Resend", exc)

    # ── 2. Resend REST API ───────────────────────────────────────────────────
    if not settings.RESEND_API_KEY:
        logger.warning("[DEV] No email backend configured — email to %s not sent. Subject: %s", to, subject)
        return
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json={"from": settings.FROM_EMAIL, "to": [to], "subject": subject, "html": html},
        )
    if resp.status_code not in (200, 201):
        logger.error("Resend API error %s: %s", resp.status_code, resp.text)
        if resp.status_code == 403:
            logger.warning(
                "[DEV] Resend blocked delivery to %s (unverified recipient on free tier). "
                "Subject: %s — check docker compose logs for OTP", to, subject
            )
            return
        raise RuntimeError(f"Email delivery failed ({resp.status_code})")


# ── OTP verification email ────────────────────────────────────────────────────

async def send_otp_email(to_email: str, full_name: str, otp: str) -> None:
    if not settings.RESEND_API_KEY:
        logger.warning("[DEV] OTP for %s: %s", to_email, otp)
        return
    # Always log OTP — Resend may block non-verified recipients on free tier
    logger.info("[OTP] %s → %s", to_email, otp)
    body = f"""
      <p style="color:#a1a1aa;font-size:14px;margin:0 0 8px">Hi {full_name or 'there'},</p>
      <p style="color:#f4f4f5;font-size:16px;font-weight:600;margin:0 0 24px">
        Verify your email address
      </p>
      <p style="color:#71717a;font-size:13px;margin:0 0 20px">
        Enter this 6-digit code to complete your sign-up. It expires in 10 minutes.
      </p>
      <div style="background:#1c1c1f;border:1px solid rgba(255,255,255,0.08);
                  border-radius:10px;padding:20px;text-align:center;margin-bottom:24px">
        <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#f4f4f5;
                     font-family:ui-monospace,monospace">{otp}</span>
      </div>
      <p style="color:#52525b;font-size:12px;margin:0">
        This code is single-use and expires after 10 minutes.
        If you did not request this, you can safely ignore this email.
      </p>"""
    await _send(to_email, "CivicPulse — your verification code", _wrap(body))


# ── Operator approval request email (to main operator) ───────────────────────

async def send_operator_request_email(
    requester_name: str,
    requester_email: str,
    approve_url: str,
    reject_url: str,
) -> None:
    if not settings.MAIN_OPERATOR_EMAIL:
        logger.warning(
            "[DEV] MAIN_OPERATOR_EMAIL not set — operator request from %s not forwarded.",
            requester_email,
        )
        logger.warning("[DEV] Approve URL: %s", approve_url)
        return
    body = f"""
      <p style="color:#f4f4f5;font-size:16px;font-weight:600;margin:0 0 16px">
        Operator access request
      </p>
      <p style="color:#a1a1aa;font-size:14px;margin:0 0 20px">
        <strong style="color:#f4f4f5">{requester_name}</strong>
        (<span style="color:#71717a">{requester_email}</span>)
        has requested operator access on CivicPulse.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr>
        <td style="padding-right:12px">
          <a href="{approve_url}"
             style="display:inline-block;background:#16a34a;color:#fff;
                    text-decoration:none;font-size:14px;font-weight:600;
                    padding:10px 24px;border-radius:8px">
            Approve
          </a>
        </td>
        <td>
          <a href="{reject_url}"
             style="display:inline-block;background:#dc2626;color:#fff;
                    text-decoration:none;font-size:14px;font-weight:600;
                    padding:10px 24px;border-radius:8px">
            Reject
          </a>
        </td>
      </tr></table>
      <p style="color:#52525b;font-size:12px;margin:0">
        These links expire in 72 hours. If you do not recognise this request, ignore this email.
      </p>"""
    await _send(
        settings.MAIN_OPERATOR_EMAIL,
        f"CivicPulse — operator request from {requester_name}",
        _wrap(body),
    )


# ── Approval / rejection notification emails (to the requester) ──────────────

async def send_operator_approved_email(to_email: str, full_name: str) -> None:
    body = f"""
      <p style="color:#a1a1aa;font-size:14px;margin:0 0 8px">Hi {full_name or 'there'},</p>
      <p style="color:#f4f4f5;font-size:16px;font-weight:600;margin:0 0 16px">
        Your operator access has been approved
      </p>
      <p style="color:#71717a;font-size:13px;margin:0 0 20px">
        Your CivicPulse account has been upgraded to <strong style="color:#f4f4f5">Operator</strong>.
        Sign in to access the full dashboard and analytics.
      </p>
      <a href="{settings.FRONTEND_URL}/login"
         style="display:inline-block;background:#2563eb;color:#fff;
                text-decoration:none;font-size:14px;font-weight:600;
                padding:10px 24px;border-radius:8px">
        Sign in
      </a>"""
    await _send(to_email, "CivicPulse — operator access approved", _wrap(body))


async def send_operator_rejected_email(to_email: str, full_name: str) -> None:
    body = f"""
      <p style="color:#a1a1aa;font-size:14px;margin:0 0 8px">Hi {full_name or 'there'},</p>
      <p style="color:#f4f4f5;font-size:16px;font-weight:600;margin:0 0 16px">
        Operator access request declined
      </p>
      <p style="color:#71717a;font-size:13px;margin:0">
        Your request for operator access on CivicPulse was not approved.
        Your account remains active as a citizen.
        Contact the administrator if you believe this is a mistake.
      </p>"""
    await _send(to_email, "CivicPulse — operator access request declined", _wrap(body))
