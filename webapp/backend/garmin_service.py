"""Garmin Connect data access + timeline derivation.

Wraps the `Garmin` client from python-garminconnect to:
  * authenticate (env credentials + on-disk token store, MFA-aware)
  * pull the account's entire activity history
  * cache the raw activities to disk
  * derive a compact per-day "equalizer" timeline for the frontend
"""

from __future__ import annotations

import json
import os
import tempfile
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from garminconnect import Garmin

from config import (
    BASE_HEIGHT,
    COLOR_REST,
    MAX_COLUMN_HEIGHT,
    REST_HEIGHT,
    SEGMENT_GAP,
    bucket_for_type,
    color_for_type,
)

METERS_PER_MILE = 1609.344

# Earliest plausible activity date. Garmin Connect launched in 2007; 2005 is a
# safe lower bound that still captures everything.
EARLIEST_DATE = "2005-01-01"

# Default: webapp/data. On Render, set WORKOUT_DATA_DIR to a writable path
# inside the service (e.g. ./data) so cache + tokens survive the process lifetime.
DATA_DIR = Path(
    os.getenv(
        "WORKOUT_DATA_DIR",
        str(Path(__file__).resolve().parent.parent / "data"),
    )
).expanduser()
RAW_CACHE = DATA_DIR / "activities.json"
# Prefer an explicit GARMINTOKENS path (Render sets this next to the cache).
# Locally, fall back to the standard garminconnect token store.
TOKEN_STORE = os.getenv("GARMINTOKENS", os.path.expanduser("~/.garminconnect"))


class GarminServiceError(RuntimeError):
    """Raised when Garmin data cannot be fetched or authenticated."""


def _client() -> Garmin:
    """Build and authenticate a Garmin client.

    Uses a saved token store when available; otherwise logs in with the
    EMAIL / PASSWORD environment variables. MFA (if enabled) is prompted for
    interactively on stdin, so the first login should be run from a terminal
    (e.g. `python export.py`).
    """
    email = os.getenv("EMAIL")
    password = os.getenv("PASSWORD")

    garmin = Garmin(
        email=email,
        password=password,
        prompt_mfa=lambda: input("MFA one-time code: ").strip(),
    )
    try:
        garmin.login(TOKEN_STORE)
    except Exception as exc:  # noqa: BLE001 - surface any auth failure uniformly
        raise GarminServiceError(f"Garmin login failed: {exc}") from exc
    return garmin


def fetch_lifetime(start: str = EARLIEST_DATE, end: str | None = None) -> list[dict[str, Any]]:
    """Fetch every activity between `start` and `end` (inclusive) and cache it.

    Relies on `get_activities_by_date`, which auto-paginates until the API
    returns no more results.
    """
    end = end or date.today().isoformat()
    garmin = _client()
    try:
        activities = garmin.get_activities_by_date(start, end, sortorder="asc")
    except Exception as exc:  # noqa: BLE001
        raise GarminServiceError(f"Failed to fetch activities: {exc}") from exc

    activities = activities or []
    _write_cache(activities)
    return activities


def refresh(incremental: bool = True) -> list[dict[str, Any]]:
    """Re-pull activities.

    When `incremental` and a cache exists, only fetch from the last cached day
    forward and merge; otherwise do a full lifetime pull.
    """
    cached = load_cache()
    if not incremental or not cached:
        return fetch_lifetime()

    last_day = _max_activity_date(cached)
    start = last_day.isoformat() if last_day else EARLIEST_DATE
    garmin = _client()
    try:
        recent = garmin.get_activities_by_date(
            start, date.today().isoformat(), sortorder="asc"
        )
    except Exception as exc:  # noqa: BLE001
        raise GarminServiceError(f"Failed to refresh activities: {exc}") from exc

    merged = _merge_activities(cached, recent or [])
    _write_cache(merged)
    return merged


def load_cache() -> list[dict[str, Any]]:
    """Load the raw cached activities, or an empty list if none exist."""
    if not RAW_CACHE.exists():
        return []
    try:
        return json.loads(RAW_CACHE.read_text())
    except json.JSONDecodeError:
        return []


def build_timeline(activities: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    """Derive the per-day equalizer timeline.

    Groups activities by local calendar day. Each activity becomes its own
    vertical segment (color by type). Heights are directly proportional to
    activity minutes: one global scale factor is chosen so the tallest day
    column exactly reaches MAX_COLUMN_HEIGHT. Every rest day between the first
    activity and today is a fixed grey line.
    """
    activities = load_cache() if activities is None else activities
    if not activities:
        return []

    by_day: dict[str, list[dict[str, Any]]] = {}
    for act in activities:
        day = _activity_day(act)
        if not day:
            continue
        by_day.setdefault(day, []).append(act)

    first_day = date.fromisoformat(min(by_day))
    today = date.today()

    timeline: list[dict[str, Any]] = []
    cursor = first_day
    while cursor <= today:
        key = cursor.isoformat()
        day_acts = by_day.get(key)
        if day_acts:
            timeline.append(_build_day(key, day_acts))
        else:
            timeline.append(
                {
                    "date": key,
                    "isRest": True,
                    "count": 0,
                    "totalMinutes": 0.0,
                    "segments": [
                        {
                            "type": None,
                            "bucket": "rest",
                            "color": COLOR_REST,
                            "minutes": 0.0,
                            "height": REST_HEIGHT,
                            "distanceMi": None,
                            "pace": None,
                            "durationLabel": "rest",
                        }
                    ],
                }
            )
        cursor += timedelta(days=1)

    _scale_heights(timeline)
    return timeline


def _build_day(day: str, day_acts: list[dict[str, Any]]) -> dict[str, Any]:
    """Build a single non-rest day with one segment per activity."""
    # Keep chronological order within the day.
    day_acts = sorted(day_acts, key=lambda a: str(a.get("startTimeLocal") or ""))

    segments: list[dict[str, Any]] = []
    total_minutes = 0.0
    for act in day_acts:
        minutes = float(act.get("duration") or 0.0) / 60.0
        total_minutes += minutes
        type_key = ((act.get("activityType") or {}).get("typeKey")) or "other"
        distance_m = act.get("distance")
        miles = (distance_m / METERS_PER_MILE) if distance_m else None
        segments.append(
            {
                "type": type_key,
                "bucket": bucket_for_type(type_key),
                "color": color_for_type(type_key),
                "minutes": round(minutes, 1),
                # Placeholder; replaced by the global proportional pass in
                # _scale_heights once every day has been built.
                "height": minutes,
                "distanceMi": round(miles, 1) if miles else None,
                "pace": _pace_label(minutes, miles),
                "durationLabel": _duration_label(minutes),
            }
        )

    return {
        "date": day,
        "isRest": False,
        "count": len(segments),
        "totalMinutes": round(total_minutes, 1),
        "segments": segments,
    }


def _scale_heights(timeline: list[dict[str, Any]]) -> None:
    """Convert minute-valued heights into pixels.

    Every activity gets a fixed BASE_HEIGHT plus a duration-proportional part.
    One global pixels-per-minute factor is chosen so the tallest day column
    (bases + proportional parts + gaps) exactly reaches MAX_COLUMN_HEIGHT; every
    other segment scales linearly with its duration. Rest days keep their fixed
    height.
    """
    workout_days = [d for d in timeline if not d["isRest"] and d["totalMinutes"] > 0]
    if not workout_days:
        return

    factors: list[float] = []
    for d in workout_days:
        n = len(d["segments"])
        # Height available for the proportional part after reserving bases + gaps.
        available = MAX_COLUMN_HEIGHT - BASE_HEIGHT * n - SEGMENT_GAP * (n - 1)
        if available > 0:
            factors.append(available / d["totalMinutes"])
    factor = min(factors) if factors else 0.0

    for day in workout_days:
        for seg in day["segments"]:
            seg["height"] = max(1, int(round(BASE_HEIGHT + seg["minutes"] * factor)))


def _pace_label(minutes: float, miles: float | None) -> str | None:
    """Format running/walking pace as M:SS/mi, or None when not applicable."""
    if not miles or miles <= 0 or minutes <= 0:
        return None
    pace = minutes / miles  # minutes per mile
    m = int(pace)
    s = int(round((pace - m) * 60))
    if s == 60:
        m, s = m + 1, 0
    return f"{m}:{s:02d}/mi"


def _duration_label(minutes: float) -> str:
    if minutes <= 0:
        return "0 min"
    if minutes < 60:
        return f"{int(round(minutes))} min"
    h = int(minutes // 60)
    m = int(round(minutes % 60))
    return f"{h}h {m}m" if m else f"{h}h"


# --- internal helpers ----------------------------------------------------------
def _activity_day(act: dict[str, Any]) -> str | None:
    """Extract the local calendar day (YYYY-MM-DD) for an activity."""
    raw = act.get("startTimeLocal") or act.get("startTimeGMT")
    if not raw:
        return None
    # Values look like "2026-04-21 06:30:00"; the date portion is the first 10 chars.
    return str(raw)[:10]


def _max_activity_date(activities: list[dict[str, Any]]) -> date | None:
    days = [d for d in (_activity_day(a) for a in activities) if d]
    if not days:
        return None
    return date.fromisoformat(max(days))


def _merge_activities(
    existing: list[dict[str, Any]], incoming: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Merge two activity lists, de-duplicating by activityId."""
    by_id: dict[Any, dict[str, Any]] = {}
    for act in [*existing, *incoming]:
        by_id[act.get("activityId", id(act))] = act
    return sorted(by_id.values(), key=lambda a: str(_activity_day(a) or ""))


def _write_cache(activities: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=DATA_DIR,
            prefix=f".{RAW_CACHE.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            json.dump(activities, temporary_file, indent=2)
        os.replace(temporary_path, RAW_CACHE)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
