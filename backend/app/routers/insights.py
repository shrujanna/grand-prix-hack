import os
import csv
import json
from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter(prefix="/api/training-insights", tags=["Insights"])

# Paths relative to the project root
DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "final_labeled_dataset.csv")
INSIGHTS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "insights.json")

@router.get("")
def get_insights() -> Dict[str, Any]:
    total_samples = 0
    recent_clips = []
    
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            total_samples = len(rows)
            
            # Get last 5 rows for the live feed
            for row in rows[-5:]:
                recent_clips.append({
                    "clip_id": row.get("clip_id", ""),
                    "driver_code": row.get("driver_code", ""),
                    "lap_number": row.get("lap_number", ""),
                    "mood": row.get("human_label", ""),
                    "text": row.get("text", "")
                })
    
    # Reverse to show newest first
    recent_clips.reverse()

    calm_pct = 0.0
    stressed_pct = 0.0
    if os.path.exists(INSIGHTS_FILE):
        with open(INSIGHTS_FILE, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
                calm_pct = data.get("calm_slower_percentage", 0.0)
                stressed_pct = data.get("stressed_slower_percentage", 0.0)
            except Exception:
                pass

    return {
        "total_usable_samples": total_samples,
        "calm_slower_percentage": calm_pct,
        "stressed_slower_percentage": stressed_pct,
        "recent_clips": recent_clips
    }
