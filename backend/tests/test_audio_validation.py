import io
import os
import sys
import unittest
import wave
from unittest.mock import patch


sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.audio_validation import AudioValidationError, validate_audio_upload  # noqa: E402


def wav_bytes(seconds: float) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(8000)
        audio.writeframes(b"\x00\x00" * int(8000 * seconds))
    return output.getvalue()


class AudioValidationTests(unittest.TestCase):
    def test_accepts_a_short_wav_clip(self):
        duration = validate_audio_upload(wav_bytes(0.1), "audio/wav", "radio.wav")
        self.assertIsNotNone(duration)
        self.assertLess(duration, 1)

    def test_rejects_unsupported_content_type(self):
        with self.assertRaisesRegex(AudioValidationError, "Unsupported audio format"):
            validate_audio_upload(b"not audio", "application/octet-stream", "radio.bin")

    def test_rejects_long_clip(self):
        with patch.dict(os.environ, {"MAX_AUDIO_DURATION_SECONDS": "1"}, clear=False):
            with self.assertRaisesRegex(AudioValidationError, "seconds or shorter"):
                validate_audio_upload(wav_bytes(1.1), "audio/wav", "radio.wav")
