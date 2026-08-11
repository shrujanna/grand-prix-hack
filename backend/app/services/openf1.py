"""Small, cached adapter for the public OpenF1 timing and radio API."""

from __future__ import annotations

from functools import lru_cache
import datetime
import os
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import requests


OPENF1_BASE_URL = os.getenv("OPENF1_API_BASE_URL", "https://api.openf1.org/v1").rstrip("/")
REQUEST_TIMEOUT_SECONDS = 15


class OpenF1Error(RuntimeError):
    """Raised when OpenF1 cannot provide the requested public data."""


def _get(path: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
    try:
        response = requests.get(
            f"{OPENF1_BASE_URL}/{path.lstrip('/')}",
            params=params,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as error:
        raise OpenF1Error("OpenF1 data is temporarily unavailable. Please try again.") from error

    if not isinstance(payload, list):
        raise OpenF1Error("OpenF1 returned an unexpected response.")
    return payload


@lru_cache(maxsize=12)
def list_sessions(year: int) -> List[Dict[str, Any]]:
    """Return the sessions in a season, newest first."""
    sessions = _get("sessions", {"year": year})
    meetings = {
        meeting.get("meeting_key"): meeting
        for meeting in _get("meetings", {"year": year})
        if meeting.get("meeting_key") is not None
    }
    enriched = []
    for session in sessions:
        meeting = meetings.get(session.get("meeting_key"), {})
        enriched.append({**meeting, **session, "meeting_name": meeting.get("meeting_name") or session.get("location")})
    return sorted(enriched, key=lambda item: item.get("date_start") or "", reverse=True)


@lru_cache(maxsize=128)
def get_session(session_key: int) -> Optional[Dict[str, Any]]:
    sessions = _get("sessions", {"session_key": session_key})
    if not sessions:
        return None
    session = sessions[0]
    meeting_key = session.get("meeting_key")
    if meeting_key is None:
        return session
    meetings = _get("meetings", {"meeting_key": meeting_key})
    meeting = meetings[0] if meetings else {}
    return {**meeting, **session, "meeting_name": meeting.get("meeting_name") or session.get("location")}


@lru_cache(maxsize=256)
def list_drivers(session_key: int) -> List[Dict[str, Any]]:
    drivers = _get("drivers", {"session_key": session_key})
    return sorted(drivers, key=lambda item: item.get("name_acronym") or item.get("full_name") or "")


def _driver_index(session_key: int) -> Dict[int, Dict[str, Any]]:
    return {
        driver["driver_number"]: driver
        for driver in list_drivers(session_key)
        if isinstance(driver.get("driver_number"), int)
    }


def list_team_radio(session_key: int, driver_number: Optional[int] = None) -> List[Dict[str, Any]]:
    """Return playable radio records, enriched with the session driver directory."""
    params: Dict[str, Any] = {"session_key": session_key}
    if driver_number is not None:
        params["driver_number"] = driver_number

    drivers = _driver_index(session_key)
    radios = _get("team_radio", params)
    result: List[Dict[str, Any]] = []
    for radio in radios:
        recording_url = radio.get("recording_url")
        number = radio.get("driver_number")
        if not recording_url or not isinstance(number, int):
            continue
        driver = drivers.get(number, {})
        timestamp = radio.get("date") or ""
        result.append(
            {
                "clip_id": f"openf1-{session_key}-{number}-{timestamp}",
                "session_key": session_key,
                "driver_number": number,
                "date": timestamp,
                "driver_code": driver.get("name_acronym") or str(number),
                "driver_name": driver.get("full_name") or driver.get("broadcast_name") or f"Driver {number}",
                "team_name": driver.get("team_name"),
                "audio_url": recording_url,
                "source": "openf1",
                "is_audio_only": True,
            }
        )
    return sorted(result, key=lambda item: item["date"], reverse=True)


def radio_context(session_key: int, driver_number: int, date: str) -> Dict[str, Any]:
    """Resolve one OpenF1 message to FastF1-compatible race and lap metadata."""
    session = get_session(session_key)
    if not session:
        raise OpenF1Error("That OpenF1 session is no longer available.")

    driver = _driver_index(session_key).get(driver_number, {})
    return {
        "year": session.get("year"),
        "gp": session.get("meeting_name") or session.get("location") or "Unknown Grand Prix",
        "session": session.get("session_name") or "Race",
        "driver_code": driver.get("name_acronym") or str(driver_number),
        "driver_name": driver.get("full_name") or driver.get("broadcast_name") or f"Driver {driver_number}",
        "team_name": driver.get("team_name"),
        "date": date,
    }


@lru_cache(maxsize=256)
def list_laps(session_key: int, driver_number: int) -> List[Dict[str, Any]]:
    laps = _get("laps", {"session_key": session_key, "driver_number": driver_number})
    return sorted(laps, key=lambda item: item.get("date_start") or "")


def map_radio_to_lap(session_key: int, driver_number: int, radio_date: str) -> tuple[Optional[float], bool]:
    """Map a radio timestamp to the driver's lap using OpenF1's own clock.

    This deliberately avoids comparing two providers' session start timestamps.
    A radio belongs to the most recent lap that started at or before its time.
    FastF1 remains the source for plotted lap durations.
    """
    try:
        radio_time = datetime.datetime.fromisoformat(radio_date.replace("Z", "+00:00"))
    except ValueError:
        return None, True
    if radio_time.tzinfo is None:
        radio_time = radio_time.replace(tzinfo=datetime.timezone.utc)

    current_lap: Optional[Dict[str, Any]] = None
    for lap in list_laps(session_key, driver_number):
        date_start = lap.get("date_start")
        lap_number = lap.get("lap_number")
        if not date_start or lap_number is None:
            continue
        try:
            lap_start = datetime.datetime.fromisoformat(date_start.replace("Z", "+00:00"))
        except ValueError:
            continue
        if lap_start.tzinfo is None:
            lap_start = lap_start.replace(tzinfo=datetime.timezone.utc)
        if lap_start <= radio_time:
            current_lap = lap
        else:
            break

    if current_lap is None:
        return None, True
    return float(current_lap["lap_number"]), False


def download_team_radio(session_key: int, driver_number: int, date: str) -> tuple[bytes, str, str]:
    """Download one radio recording selected by immutable OpenF1 identifiers.

    The URL is never supplied by a browser request; it comes from OpenF1 and is
    restricted to Formula 1's public live-timing media host before downloading.
    """
    radios = _get("team_radio", {"session_key": session_key, "driver_number": driver_number})
    recording = next((item for item in radios if item.get("date") == date), None)
    if not recording or not recording.get("recording_url"):
        raise OpenF1Error("That team radio recording is no longer available.")

    recording_url = recording["recording_url"]
    if urlparse(recording_url).hostname != "livetiming.formula1.com":
        raise OpenF1Error("OpenF1 returned an unsupported radio recording host.")
    try:
        response = requests.get(recording_url, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
    except requests.RequestException as error:
        raise OpenF1Error("The radio recording could not be downloaded. Please try again.") from error
    if not response.content:
        raise OpenF1Error("The radio recording was empty.")
    return response.content, response.headers.get("content-type", "audio/mpeg"), recording_url
