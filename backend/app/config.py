from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://civicpulse:civicpulse@postgres:5432/civicpulse"
    REDIS_URL: str = "redis://redis:6379/0"

    TRIAGE_PROVIDER: str = "rules"
    GROQ_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    OLLAMA_MODEL: str = "qwen2.5:1.5b"

    RATE_LIMIT_REQUESTS: int = 60
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    RESEND_API_KEY: str = ""
    FROM_EMAIL: str = "CivicPulse <noreply@civicpulse.app>"
    FRONTEND_URL: str = "http://localhost"

    # SMTP (Gmail App Password — works for any recipient, unlike Resend free tier)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_FROM: str = ""

    # The administrator who receives and approves operator access requests
    MAIN_OPERATOR_EMAIL: str = ""
    # How long (seconds) an approval link stays valid
    OPERATOR_REQUEST_TTL_SECONDS: int = 72 * 3600  # 72 hours

    OTP_TTL_SECONDS: int = 600          # 10 minutes
    OTP_RESEND_COOLDOWN_SECONDS: int = 60
    OTP_MAX_ATTEMPTS: int = 5
    LOGIN_MAX_FAILURES: int = 10
    LOGIN_LOCKOUT_SECONDS: int = 900    # 15 minutes

    LOG_LEVEL: str = "INFO"


settings = Settings()
