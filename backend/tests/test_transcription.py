import os
import sys
import unittest
from unittest.mock import Mock, patch


sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.transcription import (  # noqa: E402
    TranscriptionConfigurationError,
    transcribe_audio,
)


class TranscriptionTests(unittest.TestCase):
    def test_requires_a_hugging_face_token(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(TranscriptionConfigurationError):
                transcribe_audio(b"audio bytes", "audio/mpeg")

    def test_sends_audio_with_its_mime_type_and_returns_text(self):
        response = Mock(status_code=200)
        response.json.return_value = {"text": "  Box, box.  "}

        with patch.dict(os.environ, {"HF_TOKEN": "test-token"}, clear=True):
            with patch("app.services.transcription.requests.post", return_value=response) as post:
                transcript = transcribe_audio(b"audio bytes", "audio/mpeg")

        self.assertEqual(transcript, "Box, box.")
        self.assertEqual(post.call_args.kwargs["headers"]["Content-Type"], "audio/mpeg")
        self.assertEqual(post.call_args.kwargs["data"], b"audio bytes")


if __name__ == "__main__":
    unittest.main()
