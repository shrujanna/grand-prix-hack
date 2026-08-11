import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.live_clips import list_live_clips, save_live_clip  # noqa: E402


class LiveClipStoreTests(unittest.TestCase):
    def test_saves_audio_and_makes_it_available_in_the_live_archive(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary_path = Path(temporary_directory)
            with patch("app.services.live_clips.UPLOAD_DIR", temporary_path / "uploads"), patch(
                "app.services.live_clips.DATABASE_PATH", temporary_path / "live.sqlite3"
            ):
                clip = save_live_clip(
                    audio_bytes=b"radio audio",
                    content_type="audio/mpeg",
                    filename="radio.mp3",
                    metadata={
                        "driver_code": "HAM",
                        "driver_name": "Lewis Hamilton",
                        "gp": "Monaco Grand Prix",
                        "session": "Race",
                        "lap_number": 12,
                    },
                    analysis={
                        "transcript": "The tyres are gone.",
                        "audio_model_label": "frustrated",
                        "audio_model_confidence": 0.8,
                        "text_model_label": "frustrated",
                        "text_model_intensity": 4,
                        "audio_duration_seconds": 2.5,
                    },
                )

                clips = list_live_clips()

            self.assertEqual(clip.source, "live")
            self.assertEqual(clip.driver_code, "HAM")
            self.assertEqual(clips[0].clip_id, clip.clip_id)
            self.assertEqual(clips[0].audio_url, clip.audio_url)
