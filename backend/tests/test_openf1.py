import os
import sys
import unittest
from unittest.mock import patch


sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import openf1  # noqa: E402


class OpenF1AdapterTests(unittest.TestCase):
    def setUp(self):
        openf1.list_sessions.cache_clear()
        openf1.get_session.cache_clear()
        openf1.list_drivers.cache_clear()
        openf1.list_laps.cache_clear()

    @patch("app.services.openf1._get")
    def test_enriches_radio_with_driver_data(self, get):
        get.side_effect = [
            [{"driver_number": 44, "name_acronym": "HAM", "full_name": "Lewis HAMILTON", "team_name": "Ferrari"}],
            [{"driver_number": 44, "date": "2025-03-16T04:00:00+00:00", "recording_url": "https://livetiming.formula1.com/radio.mp3"}],
        ]

        radios = openf1.list_team_radio(999, 44)

        self.assertEqual(radios[0]["driver_code"], "HAM")
        self.assertEqual(radios[0]["driver_name"], "Lewis HAMILTON")
        self.assertEqual(radios[0]["source"], "openf1")

    @patch("app.services.openf1._get")
    def test_session_has_meeting_name_for_fastf1(self, get):
        get.side_effect = [
            [{"session_key": 999, "meeting_key": 12, "session_name": "Race", "date_start": "2025-03-16", "year": 2025}],
            [{"meeting_key": 12, "meeting_name": "Australian Grand Prix"}],
        ]

        sessions = openf1.list_sessions(2025)

        self.assertEqual(sessions[0]["meeting_name"], "Australian Grand Prix")

    @patch("app.services.openf1._get")
    def test_maps_radio_to_the_drivers_current_openf1_lap(self, get):
        get.return_value = [
            {"lap_number": 1, "date_start": "2025-03-16T04:00:00+00:00"},
            {"lap_number": 2, "date_start": "2025-03-16T04:01:31+00:00"},
            {"lap_number": 58, "date_start": "2025-03-16T05:28:07+00:00"},
        ]

        lap, ambiguous = openf1.map_radio_to_lap(999, 1, "2025-03-16T05:28:45+00:00")

        self.assertEqual(lap, 58.0)
        self.assertFalse(ambiguous)
