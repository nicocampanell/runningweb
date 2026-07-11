"""Daily Garmin refresh scheduling and process-local serialization."""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING, Any, Protocol

import garmin_service
from garmin_service import RAW_CACHE

if TYPE_CHECKING:
    from pathlib import Path

REFRESH_INTERVAL_SECONDS = 24 * 60 * 60

logger = logging.getLogger(__name__)
_REFRESH_LOCK = threading.Lock()

RefreshResult = list[dict[str, Any]]
SleepFunction = Callable[[float], Awaitable[None]]


class RefreshFunction(Protocol):
    """Blocking refresh callback accepted by the scheduler."""

    def __call__(self, *, incremental: bool) -> RefreshResult:
        """Refresh Garmin activities."""


def seconds_until_refresh(
    cache_path: Path = RAW_CACHE,
    *,
    now: float | None = None,
    interval_seconds: float = REFRESH_INTERVAL_SECONDS,
) -> float:
    """Return the delay before the cache is due for another refresh."""
    try:
        modified_at = cache_path.stat().st_mtime
    except FileNotFoundError:
        return 0
    except OSError:
        logger.exception("Unable to inspect Garmin cache; refreshing now")
        return 0

    current_time = time.time() if now is None else now
    age = max(0.0, current_time - modified_at)
    return max(0.0, interval_seconds - age)


def refresh_serialized(*, incremental: bool = True) -> RefreshResult:
    """Refresh Garmin data while preventing process-local overlap."""
    with _REFRESH_LOCK:
        return garmin_service.refresh(incremental=incremental)


async def run_refresh_loop(
    *,
    cache_path: Path = RAW_CACHE,
    refresh_fn: RefreshFunction = refresh_serialized,
    sleep_fn: SleepFunction = asyncio.sleep,
    interval_seconds: float = REFRESH_INTERVAL_SECONDS,
) -> None:
    """Refresh when the cache expires, then retry once per full interval."""
    initial_delay = seconds_until_refresh(
        cache_path,
        interval_seconds=interval_seconds,
    )
    await sleep_fn(initial_delay)

    while True:
        worker_task = asyncio.create_task(
            asyncio.to_thread(refresh_fn, incremental=True),
            name="garmin-refresh-worker",
        )
        try:
            await asyncio.shield(worker_task)
        except asyncio.CancelledError:
            while not worker_task.done():
                try:
                    await asyncio.shield(worker_task)
                except asyncio.CancelledError:
                    continue
                except Exception:
                    break
            if not worker_task.cancelled():
                worker_task.exception()
            raise
        except Exception:
            logger.exception("Scheduled Garmin refresh failed")
        await sleep_fn(interval_seconds)
