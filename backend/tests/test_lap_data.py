import datetime
import os
import sys
import unittest
from unittest.mock import Mock, patch

import pandas as pd


sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.lap_data import map_timestamp_to_lap  # noqa: E402


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
