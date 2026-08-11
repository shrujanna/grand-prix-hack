import asyncio
import io
import os
import sys
import unittest
import wave
from unittest.mock import patch

from starlette.datastructures import Headers, UploadFile


sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.routers.analyze import analyze_clip  # noqa: E402
from app.services.transcription import TranscriptionConfigurationError  # noqa: E402


def wav_bytes() -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(8000)
        audio.writeframes(b"\x00\x00" * 800)
    return output.getvalue()


def upload() -> UploadFile:
    return UploadFile(
        io.BytesIO(wav_bytes()),
        filename="radio.wav",
        headers=Headers({"content-type": "audio/wav"}),
    )


class AnalyzeRouteTests(unittest.TestCase):
    def test_returns_independent_completed_service_statuses(self):
        with patch("app.routers.analyze.classify_audio_emotion", return_value={"label": "frustrated", "confidence": 0.8}), patch(
            "app.routers.analyze.transcribe_audio", return_value="I cannot find grip"
        ), patch(
            "app.routers.analyze.classify_text_sentiment", return_value={"label": "frustrated", "intensity": 4}
        ):
            result = asyncio.run(analyze_clip(audio=upload(), transcript=None, retry_services=None))

        self.assertEqual(result.transcription_status, "completed")
        self.assertEqual(result.audio_analysis_status, "completed")
        self.assertEqual(result.text_analysis_status, "completed")
        self.assertEqual(result.transcript, "I cannot find grip")

    def test_reports_configuration_failures_without_losing_the_response(self):
        with patch(
            "app.routers.analyze.classify_audio_emotion",
            side_effect=ValueError("HF_API_KEY (or HF_TOKEN) environment variable is not set."),
        ), patch(
            "app.routers.analyze.transcribe_audio",
            side_effect=TranscriptionConfigurationError("HF token is missing"),
        ):
            result = asyncio.run(analyze_clip(audio=upload(), transcript=None, retry_services=None))

        self.assertEqual(result.transcription_status, "unavailable")
        self.assertEqual(result.audio_analysis_status, "unavailable")
        self.assertEqual(result.text_analysis_status, "skipped")
        self.assertIn("HF_TOKEN", result.transcription_error)
