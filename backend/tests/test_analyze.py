import asyncio
import io
import os
import sys
import unittest
import wave
from unittest.mock import patch

from starlette.datastructures import Headers, UploadFile


sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.routers.analyze import analyze_clip, analyze_openf1_radio  # noqa: E402
from app.models.schemas import AnalyzeResponse  # noqa: E402
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
            result = asyncio.run(analyze_clip(audio=upload(), transcript=None, retry_services=None, save_clip=False))

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
            result = asyncio.run(analyze_clip(audio=upload(), transcript=None, retry_services=None, save_clip=False))

        self.assertEqual(result.transcription_status, "unavailable")
        self.assertEqual(result.audio_analysis_status, "unavailable")
        self.assertEqual(result.text_analysis_status, "skipped")
        self.assertIn("HF_TOKEN", result.transcription_error)

    def test_uses_transcript_estimate_when_noisy_audio_tone_fails(self):
        with patch("app.routers.analyze.classify_audio_emotion", side_effect=RuntimeError("Hugging Face API error 422")), patch(
            "app.routers.analyze.transcribe_audio", return_value="The tyres are gone"
        ), patch(
            "app.routers.analyze.classify_text_sentiment", return_value={"label": "frustrated", "intensity": 4}
        ):
            result = asyncio.run(analyze_clip(audio=upload(), transcript=None, retry_services=None, save_clip=False))

        self.assertEqual(result.audio_analysis_status, "estimated")
        self.assertTrue(result.audio_fallback)
        self.assertEqual(result.audio_model_label, "frustrated")
        self.assertEqual(result.mood_label, "frustrated")

    def test_surfaces_explicit_fatigue_cues_from_the_transcript(self):
        with patch("app.routers.analyze.classify_audio_emotion", return_value={"label": "dejected", "confidence": 0.7}), patch(
            "app.routers.analyze.transcribe_audio", return_value="I'm exhausted and I can't focus"
        ), patch(
            "app.routers.analyze.classify_text_sentiment", return_value={"label": "dejected", "intensity": 4}
        ):
            result = asyncio.run(analyze_clip(audio=upload(), transcript=None, retry_services=None, save_clip=False))

        self.assertEqual(result.fatigue_label, "high")
        self.assertEqual(result.fatigue_status, "screened")

    def test_openf1_analysis_keeps_resolved_season_and_lap_metadata(self):
        response = AnalyzeResponse(audio_model_label="neutral", audio_model_confidence=0.7)
        with patch(
            "app.routers.analyze.radio_context",
            return_value={"year": 2025, "gp": "Australian Grand Prix", "session": "Race", "driver_code": "HAM", "driver_name": "Lewis HAMILTON"},
        ), patch(
            "app.routers.analyze.download_team_radio",
            return_value=(wav_bytes(), "audio/wav", "https://livetiming.formula1.com/radio.wav"),
        ), patch("app.routers.analyze.analyze_audio_bytes", return_value=response) as analyze:
            result = asyncio.run(analyze_openf1_radio(session_key=999, driver_number=44, date="2025-03-16T04:00:00+00:00", lap_number=12))

        self.assertEqual(result.year, 2025)
        self.assertEqual(analyze.call_args.kwargs["lap_number"], 12)
        self.assertEqual(analyze.call_args.kwargs["driver_code"], "HAM")
