import os
import sys
import unittest


sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.signal_assessment import derive_mood, screen_fatigue_cues  # noqa: E402


class SignalAssessmentTests(unittest.TestCase):
    def test_uses_agreeing_voice_and_transcript_for_combined_mood(self):
        result = derive_mood(
            audio_label="frustrated",
            audio_confidence=0.8,
            audio_status="completed",
            text_label="frustrated",
            text_intensity=4,
            text_status="completed",
        )
        self.assertEqual(result["mood_label"], "frustrated")
        self.assertEqual(result["mood_source"], "combined")

    def test_noisy_audio_uses_transcript_mood(self):
        result = derive_mood(
            audio_label="unknown",
            audio_confidence=0,
            audio_status="estimated",
            text_label="dejected",
            text_intensity=3,
            text_status="completed",
            audio_fallback=True,
        )
        self.assertEqual(result["mood_label"], "dejected")
        self.assertEqual(result["mood_source"], "transcript")

    def test_flags_explicit_fatigue_but_not_general_frustration(self):
        fatigue = screen_fatigue_cues("I'm exhausted and I can't focus on the braking.")
        frustration = screen_fatigue_cues("The tyres are gone. I have no grip.")

        self.assertEqual(fatigue["fatigue_label"], "high")
        self.assertIn("self-reported exhaustion", fatigue["fatigue_evidence"])
        self.assertEqual(frustration["fatigue_label"], "no_signal")
