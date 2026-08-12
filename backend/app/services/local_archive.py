"""Serve the supplied 2026 MP3 archive without sending it to OpenF1."""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import zlib
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from app.services.lap_data import map_timestamp_to_lap


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
ARCHIVE_AUDIO_DIR = Path(os.getenv("LOCAL_ARCHIVE_AUDIO_DIR", str(DATA_DIR / "audio")))
MANIFEST_PATH = Path(os.getenv("LOCAL_ARCHIVE_MANIFEST_PATH", str(Path(__file__).resolve().parents[3] / "all_clips.json")))


class LocalArchiveError(RuntimeError):
    pass


def archive_audio_directory() -> Path:
    ARCHIVE_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    return ARCHIVE_AUDIO_DIR


def _key(value: str) -> int:
    return zlib.crc32(value.encode()) & 0x7FFFFFFF


def _date(item: dict[str, Any]) -> str:
    try:
        return dt.datetime.strptime(str(item.get("ts")), "%Y%m%d%H%M%S").replace(tzinfo=dt.timezone.utc).isoformat()
    except ValueError:
        return f"{item.get('date')}T00:00:00+00:00"


@lru_cache(maxsize=1)
def _records() -> tuple[dict[str, Any], ...]:
    if not MANIFEST_PATH.is_file():
        raise LocalArchiveError("Local 2026 radio metadata is missing.")
    try:
        items = json.loads(MANIFEST_PATH.read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise LocalArchiveError("Local 2026 radio metadata could not be read.") from error

    records = []
    for item in items:
        if not isinstance(item, dict) or item.get("year") != 2026:
            continue
        filename = Path(str(item.get("audio") or "")).name
        if not filename or not (archive_audio_directory() / filename).is_file():
            continue
        match = re.match(r"^[A-Za-z]+_(\d+)_", filename)
        driver_number = int(match.group(1)) if match else _key(str(item.get("code") or filename))
        gp, session = str(item.get("grandPrix") or "Unknown Grand Prix"), str(item.get("session") or "Race")
        records.append({
            "clip_id": str(item["clipId"]), "session_key": _key(f"{gp}|{session}"), "meeting_key": _key(gp),
            "meeting_name": gp, "session_name": session, "year": 2026, "driver_number": driver_number,
            "date": _date(item), "driver_code": str(item.get("code") or "UNK"),
            "driver_name": str(item.get("driver") or "Unknown driver"), "team_name": str(item.get("team") or ""),
            "audio_filename": filename, "audio_url": f"/archive-audio/{filename}", "source": "local", "is_audio_only": True,
        })
    return tuple(records)


def list_sessions(year: int) -> list[dict[str, Any]]:
    if year != 2026:
        return []
    sessions = {record["session_key"]: {key: record[key] for key in ("session_key", "meeting_key", "meeting_name", "session_name", "year", "date")} for record in _records()}
    return sorted(sessions.values(), key=lambda item: item["date"], reverse=True)


def list_drivers(session_key: int) -> list[dict[str, Any]]:
    drivers = {record["driver_number"]: {"driver_number": record["driver_number"], "name_acronym": record["driver_code"], "full_name": record["driver_name"], "team_name": record["team_name"]} for record in _records() if record["session_key"] == session_key}
    return sorted(drivers.values(), key=lambda item: item["name_acronym"])


def list_team_radio(session_key: int, driver_number: Optional[int] = None) -> list[dict[str, Any]]:
    return sorted([{key: value for key, value in record.items() if key != "audio_filename"} for record in _records() if record["session_key"] == session_key and (driver_number is None or record["driver_number"] == driver_number)], key=lambda item: item["date"], reverse=True)


def _record(clip_id: str) -> dict[str, Any]:
    for record in _records():
        if record["clip_id"] == clip_id:
            return record
    raise LocalArchiveError("That local recording is unavailable.")


def read_audio(clip_id: str) -> tuple[bytes, str, dict[str, Any]]:
    record = _record(clip_id)
    try:
        return (archive_audio_directory() / record["audio_filename"]).read_bytes(), "audio/mpeg", record
    except OSError as error:
        raise LocalArchiveError("That local audio file could not be read.") from error


def radio_context(clip_id: str) -> dict[str, Any]:
    record = _record(clip_id)
    lap_number, ambiguous = None, True
    try:
        timestamp = dt.datetime.fromisoformat(record["date"])
        lap_number, ambiguous = map_timestamp_to_lap(2026, record["meeting_name"], record["session_name"], record["driver_code"], timestamp)
    except Exception:
        # Timing coverage is optional; audio remains selectable and playable.
        pass
    return {**{key: record[key] for key in ("clip_id", "session_key", "driver_number", "date", "driver_code", "driver_name", "team_name", "audio_url", "source", "is_audio_only", "year")}, "gp": record["meeting_name"], "session": record["session_name"], "lap_number": lap_number, "lap_is_ambiguous": ambiguous}
