"""Auth API tests — signup, login, OTP verify, me endpoint."""
import pytest


@pytest.mark.asyncio
async def test_signup_returns_pending(client):
    resp = await client.post(
        "/api/auth/signup",
        json={
            "full_name": "Shahzad Ahmad",
            "email": "shahzad.test@civicpulse.dev",
            "password": "SecurePass1!",
            "confirm_password": "SecurePass1!",
            "role": "citizen",
        },
    )
    assert resp.status_code in (200, 201, 409)


@pytest.mark.asyncio
async def test_signup_password_mismatch_returns_422(client):
    resp = await client.post(
        "/api/auth/signup",
        json={
            "full_name": "Test User",
            "email": "mismatch@example.com",
            "password": "Password123!",
            "confirm_password": "WrongPassword!",
            "role": "citizen",
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_signup_short_password_returns_422(client):
    resp = await client.post(
        "/api/auth/signup",
        json={
            "full_name": "Test User",
            "email": "short@example.com",
            "password": "short",
            "confirm_password": "short",
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_signup_invalid_email_returns_422(client):
    resp = await client.post(
        "/api/auth/signup",
        json={
            "full_name": "Test",
            "email": "not-an-email",
            "password": "ValidPass123!",
            "confirm_password": "ValidPass123!",
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_invalid_credentials_returns_401(client):
    resp = await client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "wrongpassword"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_returns_authenticated_user(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert "email" in data
    assert "role" in data
    assert "id" in data


@pytest.mark.asyncio
async def test_verify_otp_invalid_format_returns_422(client):
    resp = await client.post(
        "/api/auth/verify",
        json={"email": "test@example.com", "otp": "abc"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_verify_otp_wrong_code_returns_400_or_404(client):
    resp = await client.post(
        "/api/auth/verify",
        json={"email": "nobody@example.com", "otp": "000000"},
    )
    assert resp.status_code in (400, 404)
