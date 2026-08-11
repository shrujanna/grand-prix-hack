import os
import fastf1
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional
import datetime

# Enable caching to avoid slow repeated requests
CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "fastf1_cache")
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

# explicit mapping to help fastf1 fuzzy matcher
GP_MAPPING = {
    "barcelona grand prix": "Spanish Grand Prix",
    "canadian grand prix": "Canadian Grand Prix",
    "monaco grand prix": "Monaco Grand Prix",
    "austrian grand prix": "Austrian Grand Prix",
    "belgian grand prix": "Belgian Grand Prix"
}

def _normalize_gp_name(gp: str) -> str:
    return GP_MAPPING.get(gp.lower().strip(), gp)


def parse_openf1_datetime(value: str) -> Optional[datetime.datetime]:
    """Parse OpenF1's ISO timestamp, including its trailing Z form."""
    if not value:
        return None
    parsed = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=datetime.timezone.utc)

def get_session_laps(year: int, gp: str, session_type: str, driver_code: str) -> List[Dict[str, Any]]:
    """
    Fetches all lap times for a specific driver in a session.
    Calculates delta from the driver's median lap time for visualizing outliers.
    """
    event_name = _normalize_gp_name(gp)
    
    try:
        # Load the session (will use cache if already downloaded)
        session = fastf1.get_session(year, event_name, session_type)
        session.load(telemetry=False, weather=False, messages=False)
        
        # Get laps for the specific driver
        laps = session.laps.pick_driver(driver_code)
        
        if laps.empty:
            return []
            
        # Calculate median lap time (ignoring NaN/outlaps/inlaps that might lack LapTime)
        valid_laps = laps.dropna(subset=['LapTime'])
        median_lap_time = valid_laps['LapTime'].median().total_seconds() if not valid_laps.empty else None
        
        result = []
        for _, lap in laps.iterrows():
            lap_num = float(lap['LapNumber'])
            lap_time_td = lap['LapTime']
            
            if pd.isna(lap_time_td):
                continue # Skip laps without a recorded time
                
            lap_time_sec = lap_time_td.total_seconds()
            
            delta = None
            if median_lap_time is not None:
                delta = lap_time_sec - median_lap_time
                
            result.append({
                "lap_number": lap_num,
                "lap_time": lap_time_sec,
                "delta_from_median": delta
            })
            
        return result
    except Exception as e:
        print(f"Error fetching FastF1 session laps: {e}")
        return []

def map_timestamp_to_lap(year: int, gp: str, session_type: str, msg_datetime: datetime.datetime) -> Tuple[Optional[float], Optional[bool]]:
    """
    Maps an absolute UTC datetime to a session lap number.
    Returns (lap_number, is_ambiguous).
    """
    event_name = _normalize_gp_name(gp)
    try:
        session = fastf1.get_session(year, event_name, session_type)
        session.load(telemetry=False, weather=False, messages=False)
        
        session_start = session.session_info.get('StartDate')
        if not session_start:
            return None, True
            
        session_start = pd.to_datetime(session_start)
        if session_start.tzinfo is None:
            session_start = session_start.tz_localize('UTC')
        else:
            session_start = session_start.tz_convert('UTC')
        if msg_datetime.tzinfo is None:
            msg_datetime = msg_datetime.replace(tzinfo=datetime.timezone.utc)
            
        time_offset = msg_datetime - session_start
        
        # We need laps from the whole session to find the window
        laps = session.laps
        
        # This is a simplified approximate match using Time (session-relative time of lap completion)
        # We find the first lap that completed *after* our message time
        future_laps = laps[laps['Time'] > time_offset]
        if not future_laps.empty:
            return float(future_laps.iloc[0]['LapNumber']), False
            
        return None, True
    except Exception as e:
        print(f"Error mapping timestamp to lap: {e}")
        return None, True
