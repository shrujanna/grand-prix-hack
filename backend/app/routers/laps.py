from fastapi import APIRouter, HTTPException, Query
from typing import List
from app.models.schemas import LapChartResponse, LapPoint
from app.services.lap_data import get_session_laps
from app.services.data_loader import filter_clips
from app.services.performance_insights import build_performance_insights

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
    
    performance = build_performance_insights(raw_laps, session_clips)
    flags_by_followup_lap = {flag["followup_lap"]: flag for flag in performance["flags"]}
    enrichment_by_lap = performance.pop("lap_enrichment")

    # Create a quick lookup dictionary by lap_number
    # (Assuming one clip per lap for simplicity of the chart overlay)
    clips_by_lap = {c.lap_number: c for c in session_clips if c.lap_number is not None}
    
    lap_points: List[LapPoint] = []
    
    for lap in raw_laps:
        lap_num = lap["lap_number"]
        lap_time = lap["lap_time"]
        delta = lap["delta_from_median"]
        followup_flag = flags_by_followup_lap.get(float(lap_num))
        enrichment = enrichment_by_lap.get(float(lap_num), {})
        lap_context = {
            key: lap.get(key)
            for key in (
                "sector_1_time", "sector_2_time", "sector_3_time", "tyre_compound", "tyre_age",
                "is_pit_lap", "track_status", "safety_car", "weather", "traffic",
            )
        }
        
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
                    is_ambiguous=clip.lap_is_ambiguous,
                    concerning_radio_before=bool(followup_flag),
                    concern_reason=followup_flag["reason"] if followup_flag else None,
                    **enrichment,
                    **lap_context,
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
                    is_ambiguous=None,
                    concerning_radio_before=bool(followup_flag),
                    concern_reason=followup_flag["reason"] if followup_flag else None,
                    **enrichment,
                    **lap_context,
                )
            )
            
    return LapChartResponse(
        gp=gp,
        session=session,
        driver_code=driver,
        laps=lap_points,
        performance=performance,
    )
