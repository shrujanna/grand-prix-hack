from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from app.services.lap_data import _normalize_gp_name
import fastf1
import pandas as pd

router = APIRouter(
    prefix="/api/telemetry",
    tags=["Telemetry"]
)

class TrackPoint(BaseModel):
    x: float
    y: float

class CornerMarker(BaseModel):
    x: float
    y: float
    number: str

class TrackMapResponse(BaseModel):
    gp: str
    session: str
    driver: str
    year: int
    track_path: List[TrackPoint]
    corners: Optional[List[CornerMarker]] = None

@router.get("/track-map", response_model=TrackMapResponse)
def get_track_map(
    gp: str = Query(..., description="Grand Prix name (e.g. Monaco Grand Prix)"),
    session: str = Query(..., description="Session name (e.g. Race, Qualifying)"),
    driver: str = Query(..., description="3-letter driver code (e.g. LAW)"),
    year: int = Query(2026, description="Year of the session")
):
    event_name = _normalize_gp_name(gp)
    
    try:
        # Load the session WITH telemetry this time
        # This takes 20-30s the first time for a new race, but is cached instantly after.
        sess = fastf1.get_session(year, event_name, session)
        sess.load(telemetry=True, weather=False, messages=False)
        
        # We just need any valid lap to draw the track shape. Let's use the driver's fastest lap.
        # Or if the driver didn't set a time, the fastest lap of the session.
        laps = sess.laps.pick_driver(driver)
        if laps.empty:
            raise HTTPException(status_code=404, detail="No lap data found for this driver.")
            
        lap = laps.pick_fastest()
        if pd.isna(lap['LapTime']):
            lap = laps.iloc[0] # Fallback to any lap
            
        tel = lap.get_telemetry()
        
        # Subsample points to reduce JSON payload size (e.g., every 5th point)
        tel_subsampled = tel.iloc[::5]
        
        points = []
        for _, row in tel_subsampled.iterrows():
            if pd.isna(row['X']) or pd.isna(row['Y']):
                continue
            points.append(TrackPoint(x=float(row['X']), y=float(row['Y'])))
            
        if not points:
            raise HTTPException(status_code=404, detail="No telemetry available to draw track.")
            
        corners_list = []
        try:
            circuit_info = sess.get_circuit_info()
            for _, c in circuit_info.corners.iterrows():
                if not pd.isna(c['X']) and not pd.isna(c['Y']):
                    corners_list.append(CornerMarker(x=float(c['X']), y=float(c['Y']), number=str(c['Number'])))
        except Exception as e:
            print(f"Failed to fetch corners: {e}")
            
        return TrackMapResponse(
            gp=gp,
            session=session,
            driver=driver,
            year=year,
            track_path=points,
            corners=corners_list
        )
    except Exception as e:
        print(f"Error fetching track map: {e}")
        raise HTTPException(status_code=500, detail="Failed to load track telemetry.")

class ClipLocationResponse(BaseModel):
    x: float
    y: float
    corner: Optional[str] = None

@router.get("/clip-location", response_model=ClipLocationResponse)
def get_clip_location(clip_id: str = Query(...)):
    from app.services.local_archive import radio_context
    import datetime
    
    try:
        context = radio_context(clip_id)
        import json
        from pathlib import Path
        import os
        import math
        
        manifest_path = Path(os.getenv("LOCAL_ARCHIVE_MANIFEST_PATH", str(Path(__file__).resolve().parents[3] / "all_clips.json")))
        with open(manifest_path, 'r') as f:
            clips = json.load(f)
            
        clip = next((c for c in clips if c["clipId"] == clip_id), None)
        if not clip:
            raise HTTPException(status_code=404, detail="Clip not found.")
            
        date_str = clip.get("date")
        if not date_str:
            raise HTTPException(status_code=404, detail="No date available for clip.")
            
        ts = clip.get("ts")
        if ts:
            ts_str = str(ts)
            msg_time = datetime.datetime.strptime(ts_str, "%Y%m%d%H%M%S").replace(tzinfo=datetime.timezone.utc)
        else:
            msg_time = pd.to_datetime(date_str).replace(tzinfo=datetime.timezone.utc)
            
        sess = fastf1.get_session(clip.get("year", 2026), _normalize_gp_name(clip["grandPrix"]), clip["session"])
        sess.load(telemetry=True, weather=False, messages=False)
        
        # Calculate offset from session start
        session_start = pd.to_datetime(sess.session_info.get('StartDate') or sess.date)
        if session_start.tzinfo is None:
            session_start = session_start.tz_localize('UTC')
        else:
            session_start = session_start.tz_convert('UTC')
            
        time_offset = msg_time - session_start
        
        # Find telemetry at this time offset
        driver_info = sess.get_driver(clip["code"])
        driver_num = str(driver_info["DriverNumber"])
        tel = sess.pos_data[driver_num]
        closest = tel.iloc[(tel['Time'] - time_offset).abs().argsort()[:1]]
        
        if closest.empty or pd.isna(closest.iloc[0]['X']):
            raise HTTPException(status_code=404, detail="Telemetry coordinate not found.")
            
        x = float(closest.iloc[0]['X'])
        y = float(closest.iloc[0]['Y'])
        
        # Map to closest corner
        corner_str = None
        try:
            circuit_info = sess.get_circuit_info()
            corners = circuit_info.corners
            min_dist = float('inf')
            closest_corner = None
            
            for _, c in corners.iterrows():
                dist = math.hypot(c['X'] - x, c['Y'] - y)
                if dist < min_dist:
                    min_dist = dist
                    closest_corner = c['Number']
                    
            # If they are within a reasonable 2D distance of the corner apex (e.g. 500 units)
            if min_dist < 600 and closest_corner:
                corner_str = f"Turn {closest_corner}"
        except Exception as ce:
            print(f"Corner detection failed: {ce}")
            
        return ClipLocationResponse(x=x, y=y, corner=corner_str)
        
    except Exception as e:
        print(f"Error fetching clip location: {e}")
        raise HTTPException(status_code=500, detail="Failed to load clip location.")
