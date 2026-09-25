import asyncio
import logging
import signal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

Instrumentator().instrument(app).expose(app, endpoint="/metrics")


@app.on_event("startup")
async def on_startup() -> None:
    _install_sigterm_handler(app)
    logger.info("CivicPulse backend started — provider=%s", settings.TRIAGE_PROVIDER)
