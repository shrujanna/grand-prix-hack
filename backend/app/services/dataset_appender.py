import os
import csv
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Fallback path if not set in .env (assumes we are in backend/app/services/)
DEFAULT_DATA_FILE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 
    "final_labeled_dataset.csv"
)

def append_to_dataset(clip, response: Optional[Dict[str, Any]] = None):
    """
    Appends an analyzed clip to the final labeled dataset CSV.
    Checks for duplicates before appending.
    """
    csv_path = os.getenv("DATA_FILE_PATH", DEFAULT_DATA_FILE_PATH)
    
    if not os.path.exists(csv_path):
        logger.warning(f"Dataset CSV not found at {csv_path}. Cannot append clip.")
        return

    clip_id = getattr(clip, 'clip_id', '')
    if not clip_id and isinstance(clip, dict):
        clip_id = clip.get('clip_id', '')

    if not clip_id:
        logger.warning("No clip_id provided; skipping dataset append.")
        return

    try:
        # Check if clip_id already exists
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            if headers:
                clip_id_index = headers.index("clip_id") if "clip_id" in headers else 0
                for r in reader:
                    if len(r) > clip_id_index and r[clip_id_index] == clip_id:
                        logger.info(f"Clip {clip_id} already exists in dataset. Skipping.")
                        return

        if response is None:
            # If no separate response dict is provided, extract from clip (AnalyzeResponse object)
            transcript = getattr(clip, 'transcript', '')
            mood_label = getattr(clip, 'mood_label', '')
            mood_confidence = getattr(clip, 'mood_confidence', '')
            audio_model_label = getattr(clip, 'audio_model_label', '')
            text_model_label = getattr(clip, 'text_model_label', '')
        else:
            transcript = response.get("transcript", "")
            mood_label = response.get("mood_label", "")
            mood_confidence = response.get("mood_confidence", "")
            audio_model_label = response.get("audio_model_label", "")
            text_model_label = response.get("text_model_label", "")

        row = {
            "clip_id": clip_id,
            "gp": getattr(clip, 'gp', '') or '',
            "session": getattr(clip, 'session', '') or '',
            "driver_code": getattr(clip, 'driver_code', '') or '',
            "driver_name": getattr(clip, 'driver_name', '') or '',
            "speaker": "driver",
            "text": transcript,
            "is_audio_only": False,
            "human_label": mood_label,
            "human_label_intensity": mood_confidence,
            "audio_model_label": audio_model_label,
            "text_model_label": text_model_label,
            "lap_number": getattr(clip, 'lap_number', '') if getattr(clip, 'lap_number', None) is not None else "",
            "lap_is_ambiguous": "",
            "audio_url": getattr(clip, 'audio_url', '') or ""
        }

        fieldnames = [
            "clip_id", "gp", "session", "driver_code", "driver_name", 
            "speaker", "text", "is_audio_only", "human_label", 
            "human_label_intensity", "audio_model_label", "text_model_label", 
            "lap_number", "lap_is_ambiguous", "audio_url"
        ]

        with open(csv_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writerow(row)
            
        logger.info(f"Successfully appended clip {clip_id} to {csv_path}")
    except Exception as e:
        logger.error(f"Failed to append clip {clip_id} to dataset: {e}")
