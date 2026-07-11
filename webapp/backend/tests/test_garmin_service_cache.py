from __future__ import annotations

import json
import os
from pathlib import Path

import garmin_service
import pytest


def _configure_cache(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> Path:
    cache_path = tmp_path / "activities.json"
    monkeypatch.setattr(garmin_service, "DATA_DIR", tmp_path)
    monkeypatch.setattr(garmin_service, "RAW_CACHE", cache_path)
    return cache_path


def test_write_cache_atomically_replaces_existing_file(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    cache_path = _configure_cache(monkeypatch, tmp_path)
    cache_path.write_text('[{"activityId": "old"}]')
    activities = [{"activityId": 42}]
    real_replace = os.replace
    temporary_paths: list[Path] = []

    def observed_replace(source: str | Path, destination: str | Path) -> None:
        temporary_path = Path(source)
        temporary_paths.append(temporary_path)
        assert temporary_path.parent == tmp_path
        assert json.loads(temporary_path.read_text()) == activities
        assert json.loads(cache_path.read_text()) == [{"activityId": "old"}]
        real_replace(source, destination)

    monkeypatch.setattr(garmin_service.os, "replace", observed_replace)

    garmin_service._write_cache(activities)

    assert len(temporary_paths) == 1
    assert json.loads(cache_path.read_text()) == activities
    assert not temporary_paths[0].exists()


def test_write_cache_removes_temporary_file_when_replace_fails(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    cache_path = _configure_cache(monkeypatch, tmp_path)
    cache_path.write_text('[{"activityId": "old"}]')
    temporary_paths: list[Path] = []

    def failing_replace(source: str | Path, destination: str | Path) -> None:
        temporary_path = Path(source)
        temporary_paths.append(temporary_path)
        assert temporary_path.exists()
        raise OSError("replace failed")

    monkeypatch.setattr(garmin_service.os, "replace", failing_replace)

    with pytest.raises(OSError, match="replace failed"):
        garmin_service._write_cache([{"activityId": 42}])

    assert len(temporary_paths) == 1
    assert json.loads(cache_path.read_text()) == [{"activityId": "old"}]
    assert not temporary_paths[0].exists()


def test_build_timeline_extends_through_today() -> None:
    today = garmin_service.date.today()
    first_day = today - garmin_service.timedelta(days=2)

    timeline = garmin_service.build_timeline(
        [
            {
                "activityId": 1,
                "startTimeLocal": f"{first_day.isoformat()} 07:00:00",
                "duration": 3600,
                "activityType": {"typeKey": "running"},
            }
        ]
    )

    assert timeline[0]["date"] == first_day.isoformat()
    assert timeline[-1]["date"] == today.isoformat()
    assert len(timeline) == 3
