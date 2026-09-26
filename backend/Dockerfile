# --- build stage ---
FROM python:3.12-slim AS builder

WORKDIR /build

RUN pip install --no-cache-dir hatchling==1.25.0

COPY pyproject.toml .
RUN pip install --no-cache-dir --prefix=/install ".[dev]" 2>/dev/null || \
    pip install --no-cache-dir --prefix=/install .

COPY . .

# --- runtime stage ---
FROM python:3.12-slim AS runtime

WORKDIR /app

# Non-root user
RUN addgroup --system civicpulse && adduser --system --ingroup civicpulse civicpulse

COPY --from=builder /install /usr/local
COPY --from=builder /build/app ./app
COPY --from=builder /build/alembic ./alembic
COPY --from=builder /build/alembic.ini ./alembic.ini

USER civicpulse

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
