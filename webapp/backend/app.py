"""FastAPI service for the Workout Equalizer webapp.

Serves the derived per-day timeline (from cached Garmin data) and exposes a
refresh endpoint plus the visual config.
"""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress
from datetime import date
from typing import TYPE_CHECKING

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

# Load .env before importing modules that read env vars at call time.
load_dotenv()

from config import MAX_COLUMN_HEIGHT, config_payload  # noqa: E402
from garmin_service import (  # noqa: E402
    GarminServiceError,
    build_timeline,
    load_cache,
)
from refresh_scheduler import (  # noqa: E402
    refresh_serialized,
    run_refresh_loop,
    seconds_until_refresh,
)

logger = logging.getLogger(__name__)

_LOCAL_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
)


def cors_origins(raw: str | None = None) -> list[str]:
    """Local Vite origins plus optional comma-separated CORS_ORIGINS (Vercel URL)."""
    configured = raw if raw is not None else os.getenv("CORS_ORIGINS", "")
    extras = [
        origin.strip().rstrip("/")
        for origin in configured.split(",")
        if origin.strip()
    ]
    # Preserve order while de-duplicating.
    return list(dict.fromkeys([*_LOCAL_ORIGINS, *extras]))


def _timeline_payload(timeline: list[dict]) -> dict:
    """Shared timeline response fields for GET and POST handlers."""
    last_date = timeline[-1]["date"] if timeline else date.today().isoformat()
    return {
        "count": len(timeline),
        "restDays": sum(1 for d in timeline if d["isRest"]),
        "workoutDays": sum(1 for d in timeline if not d["isRest"]),
        "maxColumn": MAX_COLUMN_HEIGHT,
        "today": date.today().isoformat(),
        "lastDate": last_date,
        "timeline": timeline,
    }


def _schedule_refresh_if_due(background_tasks: BackgroundTasks) -> None:
    """Kick off an incremental Garmin pull when the cache is older than 24 hours."""
    if seconds_until_refresh() > 0 or not load_cache():
        return
    background_tasks.add_task(_refresh_in_background)


def _refresh_in_background() -> None:
    try:
        refresh_serialized(incremental=True)
    except GarminServiceError:
        logger.exception("Background Garmin refresh failed")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Run one daily Garmin refresh loop for this FastAPI process."""
    refresh_task = asyncio.create_task(
        run_refresh_loop(),
        name="garmin-refresh-scheduler",
    )
    try:
        yield
    finally:
        refresh_task.cancel()
        with suppress(asyncio.CancelledError):
            await refresh_task


app = FastAPI(title="Workout Equalizer API", version="1.0.0", lifespan=lifespan)

# Local Vite ports plus production frontend origin(s) from CORS_ORIGINS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    cached = load_cache()
    seconds_until = seconds_until_refresh()
    return {
        "status": "ok",
        "cachedActivities": len(cached),
        "today": date.today().isoformat(),
        "nextRefreshInSeconds": int(seconds_until),
    }


@app.get("/api/config")
def get_config() -> dict:
    return config_payload()


@app.get("/api/timeline")
def get_timeline(background_tasks: BackgroundTasks) -> dict:
    _schedule_refresh_if_due(background_tasks)
    return _timeline_payload(build_timeline())


@app.post("/api/refresh")
def post_refresh(full: bool = False) -> dict:
    """Re-pull activities from Garmin. `?full=true` forces a lifetime pull."""
    try:
        activities = refresh_serialized(incremental=not full)
    except GarminServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    timeline = build_timeline(activities)
    return {
        "fetched": len(activities),
        **_timeline_payload(timeline),
    }
