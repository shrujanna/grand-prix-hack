import os
import sys
import unittest


sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.schemas import Clip, MoodLabel  # noqa: E402
from app.services.performance_insights import build_performance_insights  # noqa: E402


def clip(*, clip_id: str, lap: float, mood: MoodLabel | None = None, fatigue: str | None = None) -> Clip:
    return Clip(
        clip_id=clip_id,
        gp="Demo Grand Prix",
        session="Race",
        driver_code="VER",
        driver_name="Max Verstappen",
        speaker="driver",
        is_audio_only=False,
        human_label=mood,
        fatigue_label=fatigue,
        lap_number=lap,
        audio_url="/media/radio.mp3",
    )


class PerformanceInsightsTests(unittest.TestCase):
    def test_flags_the_next_lap_after_a_concerning_radio_and_reports_delta(self):
        result = build_performance_insights(
            [
                {"lap_number": 1, "lap_time": 90.0},
                {"lap_number": 2, "lap_time": 90.2},
                {"lap_number": 3, "lap_time": 91.0},
                {"lap_number": 4, "lap_time": 90.1},
            ],
            [clip(clip_id="RADIO_1", lap=2, mood=MoodLabel.frustrated)],
        )

        self.assertEqual(result["baseline_lap_time"], 90.15)
        self.assertEqual(result["concerning_events"], 1)
        self.assertEqual(result["flags"][0]["followup_lap"], 3.0)
        self.assertEqual(result["flags"][0]["followup_delta"], 0.85)
        self.assertIn("0.850s slower", result["summary"])

    def test_does_not_treat_neutral_radio_as_a_concerning_event(self):
        result = build_performance_insights(
            [{"lap_number": 1, "lap_time": 90.0}, {"lap_number": 2, "lap_time": 90.2}],
            [clip(clip_id="RADIO_1", lap=1, mood=MoodLabel.neutral)],
        )

        self.assertEqual(result["concerning_events"], 0)
        self.assertEqual(result["flags"], [])

    def test_marks_pit_or_safety_car_followups_as_race_context_not_driver_state(self):
        result = build_performance_insights(
            [
                {"lap_number": 1, "lap_time": 90.0},
                {"lap_number": 2, "lap_time": 91.0, "is_pit_lap": True, "safety_car": True},
                {"lap_number": 3, "lap_time": 90.2},
            ],
            [clip(clip_id="RADIO_1", lap=1, mood=MoodLabel.dejected)],
        )

        flag = result["flags"][0]
        self.assertEqual(flag["context_category"], "race_condition")
        self.assertEqual(flag["context_notes"], ["pit lap", "safety-car or VSC"])
        self.assertEqual(result["timeline"][0]["mood_label"], "dejected")
        self.assertEqual(result["timeline"][2]["pace_trend"], "improving")

    def test_produces_session_cards_and_compares_driver_state_across_stints(self):
        result = build_performance_insights(
            [
                {"lap_number": 1, "lap_time": 90.0},
                {"lap_number": 2, "lap_time": 91.0, "is_pit_lap": True},
                {"lap_number": 3, "lap_time": 89.5},
                {"lap_number": 4, "lap_time": 89.7},
            ],
            [
                clip(clip_id="RADIO_1", lap=1, mood=MoodLabel.frustrated),
                clip(clip_id="RADIO_2", lap=3, mood=MoodLabel.happy),
            ],
        )

        self.assertEqual(result["fastest_lap_time"], 89.5)
        self.assertEqual(result["average_lap_time"], 90.05)
        self.assertEqual(result["slowest_lap_time"], 91.0)
        self.assertEqual(len(result["stints"]), 2)
        self.assertEqual(result["stints"][0]["concerning_radio_events"], 1)
        self.assertEqual(result["stints"][1]["mood_events"], ["happy"])
