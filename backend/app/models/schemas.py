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
    mood_label: Optional[str] = None
    mood_confidence: Optional[float] = None
    mood_source: Optional[str] = None
    fatigue_label: Optional[str] = None
    fatigue_confidence: Optional[float] = None
    fatigue_evidence: List[str] = []
    fatigue_status: Optional[str] = None

class AnalyzeResponse(BaseModel):
    transcript: Optional[str] = None
    audio_model_label: str
    audio_model_confidence: float
    text_model_label: Optional[str] = None
    text_model_intensity: Optional[int] = None
    transcription_status: Literal["completed", "provided", "no_speech", "unavailable", "failed", "skipped"] = "skipped"
    transcription_error: Optional[str] = None
    audio_analysis_status: Literal["completed", "estimated", "unavailable", "failed", "skipped"] = "skipped"
    audio_analysis_error: Optional[str] = None
    audio_fallback: bool = False
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
    mood_label: str = "unknown"
    mood_confidence: float = 0.0
    mood_source: Literal["combined", "voice", "transcript", "unknown"] = "unknown"
    fatigue_label: Literal["high", "watch", "no_signal", "unknown"] = "unknown"
    fatigue_confidence: float = 0.0
    fatigue_evidence: List[str] = []
    fatigue_status: Literal["screened", "skipped"] = "skipped"

class LapPoint(BaseModel):
    lap_number: float
    lap_time: float
    delta_from_median: Optional[float] = None
    clip_id: Optional[str] = None
    human_label: Optional[MoodLabel] = None
    human_label_intensity: Optional[int] = None
    is_ambiguous: Optional[bool] = None
    concerning_radio_before: bool = False
    concern_reason: Optional[str] = None
    rolling_lap_time: Optional[float] = None
    pace_trend: Optional[Literal["improving", "worsening", "stable", "warming_up"]] = None
    sector_1_time: Optional[float] = None
    sector_2_time: Optional[float] = None
    sector_3_time: Optional[float] = None
    tyre_compound: Optional[str] = None
    tyre_age: Optional[float] = None
    is_pit_lap: bool = False
    track_status: Optional[str] = None
    safety_car: bool = False
    weather: Optional[str] = None
    traffic: Optional[str] = None

class PerformanceFlag(BaseModel):
    clip_id: str
    radio_lap: float
    followup_lap: float
    mood_label: Optional[str] = None
    fatigue_label: Optional[str] = None
    reason: str
    followup_delta: float
    followup_is_slower: bool
    context_category: Literal["driver_state_signal", "race_condition"]
    context_notes: List[str] = []

class TimelineEvent(BaseModel):
    lap_number: float
    lap_time: float
    delta_from_median: Optional[float] = None
    pace_trend: Optional[Literal["improving", "worsening", "stable", "warming_up"]] = None
    clip_id: Optional[str] = None
    mood_label: Optional[str] = None
    fatigue_label: Optional[str] = None
    race_context: List[str] = []

class StintSummary(BaseModel):
    stint_number: int
    start_lap: float
    end_lap: float
    lap_count: int
    average_lap_time: float
    concerning_radio_events: int = 0
    mood_events: List[str] = []

class PerformanceSummary(BaseModel):
    baseline_lap_time: Optional[float] = None
    radio_events: int = 0
    concerning_events: int = 0
    slower_followups: int = 0
    average_followup_delta: Optional[float] = None
    fastest_lap_time: Optional[float] = None
    average_lap_time: Optional[float] = None
    slowest_lap_time: Optional[float] = None
    flags: List[PerformanceFlag] = []
    timeline: List[TimelineEvent] = []
    stints: List[StintSummary] = []
    summary: str

class LapChartResponse(BaseModel):
    gp: str
    session: str
    driver_code: str
    laps: List[LapPoint]
    performance: PerformanceSummary
