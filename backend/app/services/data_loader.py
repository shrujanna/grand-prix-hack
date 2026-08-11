import os
import pandas as pd
from typing import List, Optional
from app.models.schemas import Clip, MoodLabel

_clips_cache: List[Clip] = []

def _load_data():
    global _clips_cache
    if _clips_cache:
        return _clips_cache

    # In local dev, we use the .env DATA_FILE_PATH, fallback to default relative path
    file_path = os.environ.get("DATA_FILE_PATH", "../final_labeled_dataset.csv")
    
    if not os.path.exists(file_path):
        print(f"Warning: Dataset not found at {file_path}. Returning empty list.")
        return []

    try:
        df = pd.read_csv(file_path)
        # Parse into Clip objects
        for _, row in df.iterrows():
            clip_data = {
                "clip_id": str(row["clip_id"]),
                "gp": str(row["gp"]),
                "session": str(row["session"]),
                "driver_code": str(row["driver_code"]),
                "driver_name": str(row["driver_name"]),
                "speaker": str(row["speaker"]),
                "text": str(row["text"]) if pd.notna(row["text"]) else None,
                "is_audio_only": bool(row["is_audio_only"]),
                "human_label": MoodLabel(str(row["human_label"]).strip()) if pd.notna(row["human_label"]) else None,
                "human_label_intensity": int(row["human_label_intensity"]) if pd.notna(row["human_label_intensity"]) else None,
                "audio_model_label": str(row["audio_model_label"]) if pd.notna(row["audio_model_label"]) else None,
                "text_model_label": str(row["text_model_label"]) if pd.notna(row["text_model_label"]) else None,
                "lap_number": float(row["lap_number"]) if pd.notna(row["lap_number"]) else None,
                "lap_is_ambiguous": bool(row["lap_is_ambiguous"]) if pd.notna(row["lap_is_ambiguous"]) else None,
                "audio_url": str(row["audio_url"])
            }
            _clips_cache.append(Clip(**clip_data))
    except Exception as e:
        print(f"Failed to load dataset: {e}")
        
    return _clips_cache

def get_all_clips() -> List[Clip]:
    """Returns all loaded clips."""
    return _load_data()

def get_clip(clip_id: str) -> Optional[Clip]:
    """Returns a specific clip by ID."""
    clips = _load_data()
    return next((clip for clip in clips if clip.clip_id == clip_id), None)

def filter_clips(driver: Optional[str] = None, gp: Optional[str] = None, mood: Optional[str] = None) -> List[Clip]:
    """Filters clips by driver_code, gp, or human_label."""
    clips = _load_data()
    
    if driver:
        clips = [c for c in clips if c.driver_code.lower() == driver.lower()]
    if gp:
        clips = [c for c in clips if c.gp.lower() == gp.lower()]
    if mood:
        clips = [c for c in clips if c.human_label and c.human_label.value.lower() == mood.lower()]
        
    return clips
