"""FastAPI service for the Workout Equalizer webapp.

Serves the derived per-day timeline (from cached Garmin data) and exposes a
refresh endpoint plus the visual config.
"""

from __future__ import annotations

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Load .env before importing modules that read env vars at call time.
load_dotenv()

from config import MAX_COLUMN_HEIGHT, config_payload  # noqa: E402
from garmin_service import (  # noqa: E402
    GarminServiceError,
    build_timeline,
    load_cache,
    refresh,
)

app = FastAPI(title="Workout Equalizer API", version="1.0.0")

# Allow the Vite dev server (and common local ports) to call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    cached = load_cache()
    return {"status": "ok", "cachedActivities": len(cached)}


@app.get("/api/config")
def get_config() -> dict:
    return config_payload()


@app.get("/api/timeline")
def get_timeline() -> dict:
    timeline = build_timeline()
    return {
        "count": len(timeline),
        "restDays": sum(1 for d in timeline if d["isRest"]),
        "workoutDays": sum(1 for d in timeline if not d["isRest"]),
        "maxColumn": MAX_COLUMN_HEIGHT,
        "timeline": timeline,
    }


@app.post("/api/refresh")
def post_refresh(full: bool = False) -> dict:
    """Re-pull activities from Garmin. `?full=true` forces a lifetime pull."""
    try:
        activities = refresh(incremental=not full)
    except GarminServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    timeline = build_timeline(activities)
    return {
        "fetched": len(activities),
        "count": len(timeline),
        "maxColumn": MAX_COLUMN_HEIGHT,
        "timeline": timeline,
    }
