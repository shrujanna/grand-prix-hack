import mimetypes
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List, Optional

from app.models.schemas import Clip, MoodLabel


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
UPLOAD_DIR = DATA_DIR / "live_uploads"
DATABASE_PATH = DATA_DIR / "live_clips.sqlite3"


def _ensure_storage() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _connection() -> sqlite3.Connection:
    _ensure_storage()
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS live_clips (
            clip_id TEXT PRIMARY KEY,
            gp TEXT NOT NULL,
            session TEXT NOT NULL,
            driver_code TEXT NOT NULL,
            driver_name TEXT NOT NULL,
            speaker TEXT NOT NULL,
            text TEXT,
            human_label TEXT,
            human_label_intensity INTEGER,
            audio_model_label TEXT,
            audio_model_confidence REAL,
            text_model_label TEXT,
            text_model_intensity INTEGER,
            lap_number REAL,
            audio_url TEXT NOT NULL,
            audio_duration_seconds REAL,
            uploaded_at TEXT NOT NULL
        )
        """
    )
    return connection


def upload_directory() -> Path:
    _ensure_storage()
    return UPLOAD_DIR


def _extension(content_type: Optional[str], filename: Optional[str]) -> str:
    if filename:
        suffix = Path(filename).suffix.lower()
        if suffix and suffix in {".aac", ".flac", ".m4a", ".mp3", ".mp4", ".ogg", ".opus", ".wav", ".webm"}:
            return suffix
    return {
        "audio/aac": ".aac",
        "audio/flac": ".flac",
        "audio/m4a": ".m4a",
        "audio/mp3": ".mp3",
        "audio/mp4": ".m4a",
        "audio/mpeg": ".mp3",
        "audio/ogg": ".ogg",
        "audio/opus": ".opus",
        "audio/wav": ".wav",
        "audio/webm": ".webm",
        "audio/x-wav": ".wav",
    }.get((content_type or "").split(";", 1)[0].lower(), ".audio")


def _clip_from_row(row: sqlite3.Row) -> Clip:
    raw_label = row["human_label"]
    return Clip(
        clip_id=row["clip_id"],
        gp=row["gp"],
        session=row["session"],
        driver_code=row["driver_code"],
        driver_name=row["driver_name"],
        speaker=row["speaker"],
        text=row["text"],
        is_audio_only=not bool(row["text"]),
        human_label=MoodLabel(raw_label) if raw_label in MoodLabel._value2member_map_ else None,
        human_label_intensity=row["human_label_intensity"],
        audio_model_label=row["audio_model_label"],
        audio_model_confidence=row["audio_model_confidence"],
        text_model_label=row["text_model_label"],
        lap_number=row["lap_number"],
        lap_is_ambiguous=False,
        audio_url=row["audio_url"],
        source="live",
        uploaded_at=row["uploaded_at"],
        audio_duration_seconds=row["audio_duration_seconds"],
    )


def list_live_clips() -> List[Clip]:
    with _connection() as connection:
        rows = connection.execute("SELECT * FROM live_clips ORDER BY uploaded_at DESC").fetchall()
    return [_clip_from_row(row) for row in rows]


def save_live_clip(
    *,
    audio_bytes: bytes,
    content_type: Optional[str],
    filename: Optional[str],
    metadata: dict[str, Any],
    analysis: dict[str, Any],
) -> Clip:
    """Persist a clip and its analysis locally, ready for archive playback."""
    clip_id = f"LIVE_{uuid.uuid4().hex[:12].upper()}"
    suffix = _extension(content_type, filename)
    audio_filename = f"{clip_id}{suffix}"
    output_path = upload_directory() / audio_filename
    output_path.write_bytes(audio_bytes)
    uploaded_at = datetime.now(timezone.utc).isoformat()
    audio_url = f"/media/{audio_filename}"

    with _connection() as connection:
        connection.execute(
            """
            INSERT INTO live_clips (
                clip_id, gp, session, driver_code, driver_name, speaker, text,
                human_label, human_label_intensity, audio_model_label,
                audio_model_confidence, text_model_label, text_model_intensity,
                lap_number, audio_url, audio_duration_seconds, uploaded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                clip_id,
                metadata["gp"],
                metadata["session"],
                metadata["driver_code"],
                metadata["driver_name"],
                "driver",
                analysis.get("transcript"),
                analysis.get("audio_model_label") if analysis.get("audio_model_label") != "unknown" else None,
                None,
                analysis.get("audio_model_label"),
                analysis.get("audio_model_confidence"),
                analysis.get("text_model_label"),
                analysis.get("text_model_intensity"),
                metadata.get("lap_number"),
                audio_url,
                analysis.get("audio_duration_seconds"),
                uploaded_at,
            ),
        )

    return Clip(
        clip_id=clip_id,
        gp=metadata["gp"],
        session=metadata["session"],
        driver_code=metadata["driver_code"],
        driver_name=metadata["driver_name"],
        speaker="driver",
        text=analysis.get("transcript"),
        is_audio_only=not bool(analysis.get("transcript")),
        human_label=None,
        human_label_intensity=None,
        audio_model_label=analysis.get("audio_model_label"),
        audio_model_confidence=analysis.get("audio_model_confidence"),
        text_model_label=analysis.get("text_model_label"),
        lap_number=metadata.get("lap_number"),
        lap_is_ambiguous=False,
        audio_url=audio_url,
        source="live",
        uploaded_at=uploaded_at,
        audio_duration_seconds=analysis.get("audio_duration_seconds"),
    )
