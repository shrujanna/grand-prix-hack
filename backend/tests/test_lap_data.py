import datetime
import os
import sys
import unittest
from unittest.mock import Mock, patch

import pandas as pd


sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.lap_data import get_session_laps, map_timestamp_to_lap  # noqa: E402


class TimestampLapMappingTests(unittest.TestCase):
    @patch("app.services.lap_data.fastf1.get_session")
    def test_matches_the_selected_drivers_next_lap_completion(self, get_session):
        session = Mock()
        session.session_info = {"StartDate": "2025-03-16T04:00:00+00:00"}
        session.laps.pick_driver.return_value = pd.DataFrame(
            [
                {"LapNumber": 2, "Time": pd.Timedelta(minutes=3, seconds=2)},
                {"LapNumber": 1, "Time": pd.Timedelta(minutes=1, seconds=31)},
                {"LapNumber": 3, "Time": pd.Timedelta(minutes=4, seconds=33)},
            ]
        )
        get_session.return_value = session

        lap, ambiguous = map_timestamp_to_lap(
            2025,
            "Australian Grand Prix",
            "Race",
            "VER",
            datetime.datetime(2025, 3, 16, 4, 2, 0, tzinfo=datetime.timezone.utc),
        )

        self.assertEqual(lap, 2.0)
        self.assertFalse(ambiguous)
        session.laps.pick_driver.assert_called_once_with("VER")

    @patch("app.services.lap_data.fastf1.get_session")
    def test_returns_sector_and_race_context_when_fastf1_provides_it(self, get_session):
        session = Mock()
        session.laps.pick_driver.return_value = pd.DataFrame(
            [
                {
                    "LapNumber": 8,
                    "LapTime": pd.Timedelta(seconds=91.2),
                    "Sector1Time": pd.Timedelta(seconds=30.1),
                    "Sector2Time": pd.Timedelta(seconds=31.0),
                    "Sector3Time": pd.Timedelta(seconds=30.1),
                    "Compound": "MEDIUM",
                    "TyreLife": 8,
                    "PitInTime": pd.NaT,
                    "PitOutTime": pd.NaT,
                    "TrackStatus": "4",
                    "Time": pd.Timedelta(minutes=12),
                }
            ]
        )
        session.weather_data = pd.DataFrame(
            [{"Time": pd.Timedelta(minutes=10), "Rainfall": True, "TrackTemp": 22.0}]
        )
        get_session.return_value = session

        laps = get_session_laps(2026, "Monaco Grand Prix", "Race", "VER")

        self.assertEqual(laps[0]["sector_1_time"], 30.1)
        self.assertEqual(laps[0]["tyre_compound"], "MEDIUM")
        self.assertEqual(laps[0]["tyre_age"], 8.0)
        self.assertTrue(laps[0]["safety_car"])
        self.assertEqual(laps[0]["weather"], "rain")
