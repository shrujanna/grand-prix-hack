import io
import os
from typing import Optional

from mutagen import File as MutagenFile
from mutagen import MutagenError


DEFAULT_MAX_AUDIO_BYTES = 20 * 1024 * 1024
DEFAULT_MAX_AUDIO_DURATION_SECONDS = 120.0
SUPPORTED_AUDIO_TYPES = {
    "audio/aac",
    "audio/flac",
    "audio/m4a",
    "audio/mp3",
    "audio/mp4",
    "audio/mpeg",
    "audio/ogg",
    "audio/opus",
    "audio/wav",
    "audio/webm",
    "audio/x-wav",
}


class AudioValidationError(ValueError):
    """Raised when an upload is not a supported, safe audio clip."""


def _positive_float_setting(name: str, default: float) -> float:
    try:
        value = float(os.environ.get(name, str(default)))
        return value if value > 0 else default
    except ValueError:
        return default


def _positive_int_setting(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
        return value if value > 0 else default
    except ValueError:
        return default


def audio_duration_seconds(audio_bytes: bytes) -> Optional[float]:
    """Read duration without writing the upload to disk when its format supports it."""
    try:
        audio = MutagenFile(io.BytesIO(audio_bytes))
        length = getattr(getattr(audio, "info", None), "length", None)
        return float(length) if length is not None else None
    except (MutagenError, OSError, ValueError):
        return None


def validate_audio_upload(
    audio_bytes: bytes,
    content_type: Optional[str],
    filename: Optional[str],
) -> Optional[float]:
    """Validate an uploaded clip and return its duration when it is available."""
    if not audio_bytes:
        raise AudioValidationError("The uploaded audio file is empty.")

    normalized_type = (content_type or "").lower().split(";", 1)[0].strip()
    if normalized_type not in SUPPORTED_AUDIO_TYPES:
        raise AudioValidationError(
            "Unsupported audio format. Upload MP3, WAV, M4A, AAC, OGG, OPUS, FLAC, or WebM audio."
        )

    max_bytes = _positive_int_setting("MAX_AUDIO_UPLOAD_BYTES", DEFAULT_MAX_AUDIO_BYTES)
    if len(audio_bytes) > max_bytes:
        raise AudioValidationError(
            f"Audio clips must be {max_bytes // (1024 * 1024)} MB or smaller."
        )

    duration = audio_duration_seconds(audio_bytes)
    max_duration = _positive_float_setting(
        "MAX_AUDIO_DURATION_SECONDS", DEFAULT_MAX_AUDIO_DURATION_SECONDS
    )
    if duration is not None and duration > max_duration:
        raise AudioValidationError(
            f"Audio clips must be {int(max_duration)} seconds or shorter."
        )

    return duration
