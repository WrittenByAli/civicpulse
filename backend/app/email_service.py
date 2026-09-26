"""Transactional email via Resend REST API (httpx — no extra package needed).

If RESEND_API_KEY is empty the OTP is written to stdout only (dev fallback).
"""
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_OTP_EMAIL_HTML = """\
<!DOCTYPE html>
<html lang="en">
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
        <tr><td style="padding-top:24px">
          <p style="color:#a1a1aa;font-size:14px;margin:0 0 8px">Hi {full_name},</p>
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
            If you did not request this, you can safely ignore this email.
            This code is single-use and will become invalid once used.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""


async def send_otp_email(to_email: str, full_name: str, otp: str) -> None:
    """Send verification OTP. Falls back to logging when RESEND_API_KEY is unset."""
    if not settings.RESEND_API_KEY:
        logger.warning("[DEV] Email not sent — RESEND_API_KEY not set. OTP for %s: %s", to_email, otp)
        return

    html = _OTP_EMAIL_HTML.format(full_name=full_name or "there", otp=otp)
    payload = {
        "from": settings.FROM_EMAIL,
        "to": [to_email],
        "subject": "CivicPulse — your verification code",
        "html": html,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json=payload,
        )
    if resp.status_code not in (200, 201):
        logger.error("Resend API error %s: %s", resp.status_code, resp.text)
        raise RuntimeError(f"Email delivery failed ({resp.status_code})")
