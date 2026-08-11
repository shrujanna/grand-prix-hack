from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Literal
from enum import Enum

class MoodLabel(str, Enum):
    frustrated = "frustrated"
    neutral = "neutral"
    happy = "happy"
    dejected = "dejected"

class Clip(BaseModel):
    clip_id: str
    gp: str
    session: str
    driver_code: str
    driver_name: str
    speaker: str
    text: Optional[str] = None
    is_audio_only: bool
    human_label: Optional[MoodLabel] = None
    human_label_intensity: Optional[int] = None
    audio_model_label: Optional[str] = None
    audio_model_confidence: Optional[float] = None
    text_model_label: Optional[str] = None
    lap_number: Optional[float] = None
    lap_is_ambiguous: Optional[bool] = None
    audio_url: str
    source: Literal["archive", "live", "openf1"] = "archive"
    uploaded_at: Optional[str] = None
    year: Optional[int] = None
    audio_duration_seconds: Optional[float] = None

class AnalyzeResponse(BaseModel):
    transcript: Optional[str] = None
    audio_model_label: str
    audio_model_confidence: float
    text_model_label: Optional[str] = None
    text_model_intensity: Optional[int] = None
    transcription_status: Literal["completed", "provided", "no_speech", "unavailable", "failed", "skipped"] = "skipped"
    transcription_error: Optional[str] = None
    audio_analysis_status: Literal["completed", "unavailable", "failed", "skipped"] = "skipped"
    audio_analysis_error: Optional[str] = None
    text_analysis_status: Literal["completed", "unavailable", "failed", "skipped"] = "skipped"
    text_analysis_error: Optional[str] = None
    audio_duration_seconds: Optional[float] = None
    clip_id: Optional[str] = None
    gp: Optional[str] = None
    session: Optional[str] = None
    driver_code: Optional[str] = None
    driver_name: Optional[str] = None
    lap_number: Optional[float] = None
    audio_url: Optional[str] = None
    source: Optional[Literal["live"]] = None
    uploaded_at: Optional[str] = None
    year: Optional[int] = None

class LapPoint(BaseModel):
    lap_number: float
    lap_time: float
    delta_from_median: Optional[float] = None
    clip_id: Optional[str] = None
    human_label: Optional[MoodLabel] = None
    human_label_intensity: Optional[int] = None
    is_ambiguous: Optional[bool] = None

class LapChartResponse(BaseModel):
    gp: str
    session: str
    driver_code: str
    laps: List[LapPoint]
