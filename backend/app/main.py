import asyncio
import logging
import signal

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

from app.config import settings
from app.logging_config import configure_logging
from app.middleware import RateLimitMiddleware, RequestIdMiddleware
from app.routes import complaints, health, meta, stats

configure_logging(settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


def _install_sigterm_handler(app: FastAPI) -> None:
    loop = asyncio.get_event_loop()

    def _handle(signum, frame) -> None:
        logger.info("SIGTERM received — draining in-flight requests and shutting down")
        loop.call_soon_threadsafe(loop.stop)

    signal.signal(signal.SIGTERM, _handle)


app = FastAPI(
    title="CivicPulse",
    description="Municipal complaint intake, triage and operations platform.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Spec requires 400 (not FastAPI's default 422) for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError,
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": exc.errors()},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestIdMiddleware)

app.include_router(health.router)
app.include_router(complaints.router)
app.include_router(stats.router)
app.include_router(meta.router)

# Exposes /metrics with request count + request latency histogram (built-in)
# Custom metrics (triage_latency, fallback_counter) live in app/metrics.py
Instrumentator().instrument(app).expose(app, endpoint="/metrics")


@app.on_event("startup")
async def on_startup() -> None:
    _install_sigterm_handler(app)
    logger.info("CivicPulse backend started — provider=%s", settings.TRIAGE_PROVIDER)
