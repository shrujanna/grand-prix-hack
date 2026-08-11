from fastapi import APIRouter, HTTPException, Query
from typing import List
from app.models.schemas import LapChartResponse, LapPoint
from app.services.lap_data import get_session_laps
from app.services.data_loader import filter_clips

router = APIRouter(
    prefix="/api/laps",
    tags=["Laps"]
)

@router.get("", response_model=LapChartResponse)
def get_laps(
    gp: str = Query(..., description="Grand Prix name (e.g. Monaco Grand Prix)"),
    session: str = Query(..., description="Session name (e.g. Race, Qualifying)"),
    driver: str = Query(..., description="3-letter driver code (e.g. LAW)"),
    year: int = Query(2026, description="Year of the session")
):
    # Fetch base lap timings from FastF1
    raw_laps = get_session_laps(year, gp, session, driver)
    
    if not raw_laps:
        raise HTTPException(status_code=404, detail="No lap data found for this session/driver combination.")
        
    # Fetch labeled clips for this specific driver and gp
    # The filter_clips function doesn't filter by session, so we do it manually here
    all_driver_clips = filter_clips(driver=driver, gp=gp)
    session_clips = [c for c in all_driver_clips if c.session.lower() == session.lower()]
    
    # Create a quick lookup dictionary by lap_number
    # (Assuming one clip per lap for simplicity of the chart overlay)
    clips_by_lap = {c.lap_number: c for c in session_clips if c.lap_number is not None}
    
    lap_points: List[LapPoint] = []
    
    for lap in raw_laps:
        lap_num = lap["lap_number"]
        lap_time = lap["lap_time"]
        delta = lap["delta_from_median"]
        
        # Check if we have a labeled clip overlay for this specific lap
        clip = clips_by_lap.get(lap_num)
        
        if clip:
            lap_points.append(
                LapPoint(
                    lap_number=lap_num,
                    lap_time=lap_time,
                    delta_from_median=delta,
                    clip_id=clip.clip_id,
                    human_label=clip.human_label,
                    human_label_intensity=clip.human_label_intensity,
                    is_ambiguous=clip.lap_is_ambiguous
                )
            )
        else:
            lap_points.append(
                LapPoint(
                    lap_number=lap_num,
                    lap_time=lap_time,
                    delta_from_median=delta,
                    clip_id=None,
                    human_label=None,
                    human_label_intensity=None,
                    is_ambiguous=None
                )
            )
            
    return LapChartResponse(
        gp=gp,
        session=session,
        driver_code=driver,
        laps=lap_points
    )
