from __future__ import annotations

import asyncio
import importlib
import os
import threading
from datetime import date
from typing import TYPE_CHECKING

import garmin_service
import pytest
from fastapi import HTTPException

if TYPE_CHECKING:
    from pathlib import Path
    from types import ModuleType


def _scheduler() -> ModuleType:
    return importlib.import_module("refresh_scheduler")


def test_missing_cache_is_due_immediately(tmp_path: Path) -> None:
    scheduler = _scheduler()

    remaining = scheduler.seconds_until_refresh(
        tmp_path / "missing.json",
        now=1_000,
        interval_seconds=60,
    )

    assert remaining == 0


def test_fresh_cache_waits_for_remaining_interval(tmp_path: Path) -> None:
    scheduler = _scheduler()
    cache_path = tmp_path / "activities.json"
    cache_path.write_text("[]")
    os.utime(cache_path, (970, 970))

    remaining = scheduler.seconds_until_refresh(
        cache_path,
        now=1_000,
        interval_seconds=60,
    )

    assert remaining == 30


def test_stale_cache_is_due_immediately(tmp_path: Path) -> None:
    scheduler = _scheduler()
    cache_path = tmp_path / "activities.json"
    cache_path.write_text("[]")
    os.utime(cache_path, (900, 900))

    remaining = scheduler.seconds_until_refresh(
        cache_path,
        now=1_000,
        interval_seconds=60,
    )

    assert remaining == 0


def test_future_cache_mtime_gets_full_interval(tmp_path: Path) -> None:
    scheduler = _scheduler()
    cache_path = tmp_path / "activities.json"
    cache_path.write_text("[]")
    os.utime(cache_path, (1_010, 1_010))

    remaining = scheduler.seconds_until_refresh(
        cache_path,
        now=1_000,
        interval_seconds=60,
    )

    assert remaining == 60


def test_cache_stat_error_is_due_immediately(
    caplog: pytest.LogCaptureFixture,
) -> None:
    scheduler = _scheduler()

    class FailingCachePath:
        def stat(self) -> None:
            raise OSError("cache unavailable")

    remaining = scheduler.seconds_until_refresh(
        FailingCachePath(),
        now=1_000,
        interval_seconds=60,
    )

    assert remaining == 0
    assert "Unable to inspect Garmin cache" in caplog.text


def test_refresh_serialized_forwards_incremental_and_returns_activities(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    scheduler = _scheduler()
    activities = [{"activityId": 42}]
    incremental_values: list[bool] = []

    def fake_refresh(incremental: bool = True) -> list[dict]:
        incremental_values.append(incremental)
        return activities

    monkeypatch.setattr(scheduler.garmin_service, "refresh", fake_refresh)

    result = scheduler.refresh_serialized(incremental=False)

    assert result is activities
    assert incremental_values == [False]


def test_refresh_serialized_prevents_overlapping_refreshes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    scheduler = _scheduler()
    original_lock = scheduler._REFRESH_LOCK
    second_lock_attempted = threading.Event()
    release_first_refresh = threading.Event()
    first_refresh_started = threading.Event()
    state_lock = threading.Lock()
    active = 0
    maximum_active = 0
    calls = 0

    class ObservedLock:
        def __init__(self) -> None:
            self.attempts = 0

        def __enter__(self) -> None:
            with state_lock:
                self.attempts += 1
                if self.attempts == 2:
                    second_lock_attempted.set()
            original_lock.acquire()

        def __exit__(self, *args: object) -> None:
            original_lock.release()

    def fake_refresh(incremental: bool = True) -> list[dict]:
        nonlocal active, calls, maximum_active
        with state_lock:
            calls += 1
            active += 1
            maximum_active = max(maximum_active, active)
            call_number = calls
        if call_number == 1:
            first_refresh_started.set()
            assert release_first_refresh.wait(timeout=1)
        with state_lock:
            active -= 1
        return []

    monkeypatch.setattr(scheduler, "_REFRESH_LOCK", ObservedLock())
    monkeypatch.setattr(scheduler.garmin_service, "refresh", fake_refresh)
    first_thread = threading.Thread(target=scheduler.refresh_serialized)
    second_thread = threading.Thread(target=scheduler.refresh_serialized)

    first_thread.start()
    assert first_refresh_started.wait(timeout=1)
    second_thread.start()
    assert second_lock_attempted.wait(timeout=1)
    assert calls == 1

    release_first_refresh.set()
    threads = [first_thread, second_thread]
    for thread in threads:
        thread.join(timeout=1)

    assert all(not thread.is_alive() for thread in threads)
    assert calls == 2
    assert maximum_active == 1


def test_loop_waits_initial_delay_then_full_repeat_interval(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    scheduler = _scheduler()
    cache_path = tmp_path / "activities.json"
    delays: list[float] = []
    incremental_values: list[bool] = []

    def fake_seconds_until_refresh(
        actual_cache_path: Path,
        *,
        interval_seconds: float,
    ) -> float:
        assert actual_cache_path == cache_path
        assert interval_seconds == 60
        return 17

    async def fake_sleep(delay: float) -> None:
        delays.append(delay)
        if len(delays) == 2:
            raise asyncio.CancelledError

    def fake_refresh(*, incremental: bool) -> list[dict]:
        incremental_values.append(incremental)
        return []

    monkeypatch.setattr(
        scheduler,
        "seconds_until_refresh",
        fake_seconds_until_refresh,
    )

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(
            scheduler.run_refresh_loop(
                cache_path=cache_path,
                refresh_fn=fake_refresh,
                sleep_fn=fake_sleep,
                interval_seconds=60,
            )
        )

    assert delays == [17, 60]
    assert incremental_values == [True]


def test_loop_contains_garmin_failure_and_retries_after_full_interval(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    scheduler = _scheduler()
    delays: list[float] = []
    attempts = 0

    async def fake_sleep(delay: float) -> None:
        delays.append(delay)
        if len(delays) == 3:
            raise asyncio.CancelledError

    def fake_refresh(*, incremental: bool) -> list[dict]:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise garmin_service.GarminServiceError("Garmin unavailable")
        return []

    monkeypatch.setattr(scheduler, "seconds_until_refresh", lambda *args, **kwargs: 0)

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(
            scheduler.run_refresh_loop(
                cache_path=tmp_path / "missing.json",
                refresh_fn=fake_refresh,
                sleep_fn=fake_sleep,
                interval_seconds=60,
            )
        )

    assert attempts == 2
    assert delays == [0, 60, 60]
    assert "Scheduled Garmin refresh failed" in caplog.text


def test_loop_contains_unexpected_refresh_failure(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    scheduler = _scheduler()
    delays: list[float] = []
    attempts = 0

    async def fake_sleep(delay: float) -> None:
        delays.append(delay)
        if len(delays) == 3:
            raise asyncio.CancelledError

    def fake_refresh(*, incremental: bool) -> list[dict]:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("unexpected failure")
        return []

    monkeypatch.setattr(scheduler, "seconds_until_refresh", lambda *args, **kwargs: 0)

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(
            scheduler.run_refresh_loop(
                cache_path=tmp_path / "missing.json",
                refresh_fn=fake_refresh,
                sleep_fn=fake_sleep,
                interval_seconds=60,
            )
        )

    assert attempts == 2
    assert delays == [0, 60, 60]
    assert "Scheduled Garmin refresh failed" in caplog.text


def test_loop_waits_for_active_worker_before_propagating_cancellation(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    scheduler = _scheduler()

    async def scenario() -> None:
        loop = asyncio.get_running_loop()
        worker_started = loop.create_future()
        worker_finished = loop.create_future()
        release_worker = threading.Event()

        async def fake_sleep(delay: float) -> None:
            assert delay == 0

        def blocking_refresh(*, incremental: bool) -> list[dict]:
            loop.call_soon_threadsafe(worker_started.set_result, None)
            assert release_worker.wait(timeout=1)
            loop.call_soon_threadsafe(worker_finished.set_result, None)
            return []

        task = asyncio.create_task(
            scheduler.run_refresh_loop(
                cache_path=tmp_path / "missing.json",
                refresh_fn=blocking_refresh,
                sleep_fn=fake_sleep,
                interval_seconds=60,
            )
        )
        await worker_started

        task.cancel()
        cancellation_processed = loop.create_future()
        loop.call_soon(lambda: loop.call_soon(cancellation_processed.set_result, None))
        await cancellation_processed
        remained_pending_until_worker_finished = not task.done()

        release_worker.set()
        await worker_finished

        assert remained_pending_until_worker_finished
        with pytest.raises(asyncio.CancelledError):
            await task

    monkeypatch.setattr(scheduler, "seconds_until_refresh", lambda *args, **kwargs: 0)
    asyncio.run(scenario())


def test_lifespan_starts_one_loop_and_cancels_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app_module = importlib.import_module("app")

    async def scenario() -> None:
        starts = 0
        started = asyncio.Event()
        stopped = asyncio.Event()

        async def fake_loop() -> None:
            nonlocal starts
            starts += 1
            started.set()
            try:
                await asyncio.Future()
            finally:
                stopped.set()

        monkeypatch.setattr(app_module, "run_refresh_loop", fake_loop)

        async with app_module.lifespan(app_module.app):
            await started.wait()
            assert starts == 1

        assert stopped.is_set()

    asyncio.run(scenario())
    assert app_module.app.router.lifespan_context is app_module.lifespan


@pytest.mark.parametrize(
    ("full", "expected_incremental"),
    [(False, True), (True, False)],
)
def test_manual_refresh_uses_serialized_refresh(
    full: bool,
    expected_incremental: bool,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app_module = importlib.import_module("app")
    incremental_values: list[bool] = []
    activities = [{"activityId": 42}]

    def fake_refresh(*, incremental: bool) -> list[dict]:
        incremental_values.append(incremental)
        return activities

    monkeypatch.setattr(app_module, "refresh_serialized", fake_refresh)
    monkeypatch.setattr(app_module, "build_timeline", lambda value: [])

    response = app_module.post_refresh(full=full)

    assert response["fetched"] == 1
    assert incremental_values == [expected_incremental]


def test_manual_refresh_preserves_garmin_error_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app_module = importlib.import_module("app")

    def failing_refresh(*, incremental: bool) -> list[dict]:
        raise garmin_service.GarminServiceError("Garmin unavailable")

    monkeypatch.setattr(app_module, "refresh_serialized", failing_refresh)

    with pytest.raises(HTTPException) as exc_info:
        app_module.post_refresh()

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == "Garmin unavailable"


def test_timeline_payload_includes_today_and_last_date(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app_module = importlib.import_module("app")
    timeline = [
        {"date": "2026-07-09", "isRest": True},
        {"date": "2026-07-10", "isRest": True},
    ]

    monkeypatch.setattr(app_module, "build_timeline", lambda: timeline)

    payload = app_module._timeline_payload(timeline)

    assert payload["today"] == date.today().isoformat()
    assert payload["lastDate"] == "2026-07-10"
    assert payload["count"] == 2


def test_get_timeline_schedules_refresh_when_cache_is_due(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app_module = importlib.import_module("app")
    scheduled: list[bool] = []

    class FakeBackgroundTasks:
        def add_task(self, fn: object, *args: object, **kwargs: object) -> None:
            scheduled.append(True)
            assert fn is app_module._refresh_in_background

    monkeypatch.setattr(app_module, "seconds_until_refresh", lambda *args, **kwargs: 0)
    monkeypatch.setattr(app_module, "load_cache", lambda: [{"activityId": 1}])
    monkeypatch.setattr(app_module, "build_timeline", lambda: [])

    app_module.get_timeline(FakeBackgroundTasks())

    assert scheduled == [True]


def test_get_timeline_skips_refresh_when_cache_is_fresh(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app_module = importlib.import_module("app")
    scheduled: list[bool] = []

    class FakeBackgroundTasks:
        def add_task(self, fn: object, *args: object, **kwargs: object) -> None:
            scheduled.append(True)

    monkeypatch.setattr(app_module, "seconds_until_refresh", lambda *args, **kwargs: 3600)
    monkeypatch.setattr(app_module, "load_cache", lambda: [{"activityId": 1}])
    monkeypatch.setattr(app_module, "build_timeline", lambda: [])

    app_module.get_timeline(FakeBackgroundTasks())

    assert scheduled == []


def test_cors_origins_includes_local_and_configured_frontends() -> None:
    app_module = importlib.import_module("app")

    origins = app_module.cors_origins(
        "https://runningweb.vercel.app, https://runningweb.vercel.app/"
    )

    assert "http://localhost:5173" in origins
    assert "https://runningweb.vercel.app" in origins
    assert origins.count("https://runningweb.vercel.app") == 1


def test_cors_origins_without_env_keeps_local_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app_module = importlib.import_module("app")
    monkeypatch.delenv("CORS_ORIGINS", raising=False)

    origins = app_module.cors_origins("")

    assert origins == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
    ]

