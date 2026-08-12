# Shared Data Contract (Frontend ↔ Backend)

This document defines the JSON payload structures shared between the React frontend and the FastAPI backend. Any changes to these structures must be coordinated on both sides.

## 1. Clip Object
Represents a single labeled team radio message.

```json
{
  "clip_id": "string",
  "gp": "string",
  "session": "string",
  "driver_code": "string",
  "driver_name": "string",
  "speaker": "string (e.g. 'driver', 'engineer')",
  "text": "string | null",
  "is_audio_only": "boolean",
  "human_label": "string (enum: 'frustrated', 'neutral', 'happy', 'dejected') | null",
  "human_label_intensity": "integer (1-5) | null",
  "audio_model_label": "string | null",
  "audio_model_confidence": "float | null",
  "text_model_label": "string | null",
  "lap_number": "float | null",
  "lap_is_ambiguous": "boolean | null",
  "audio_url": "string",
  "source": "'archive' | 'live' | 'openf1'",
  "uploaded_at": "ISO 8601 timestamp | null",
  "audio_duration_seconds": "float | null",
  "mood_label": "'frustrated' | 'neutral' | 'happy' | 'dejected' | null",
  "mood_confidence": "float | null",
  "mood_source": "'combined' | 'voice' | 'transcript' | 'unknown' | null",
  "fatigue_label": "'high' | 'watch' | 'no_signal' | 'unknown' | null",
  "fatigue_confidence": "float | null",
  "fatigue_evidence": "string[]",
  "fatigue_status": "'screened' | 'skipped' | null"
}
```

## 2. AnalyzeResponse Object
Returned when `POST /api/analyze` is called with a new audio clip/transcript.

```json
{
  "transcript": "string | null",
  "audio_model_label": "string",
  "audio_model_confidence": "float",
  "text_model_label": "string | null",
  "text_model_intensity": "integer | null",
  "transcription_status": "'completed' | 'provided' | 'no_speech' | 'unavailable' | 'failed' | 'skipped'",
  "transcription_error": "string | null",
  "audio_analysis_status": "'completed' | 'estimated' | 'unavailable' | 'failed' | 'skipped'",
  "audio_analysis_error": "string | null",
  "audio_fallback": "boolean",
  "text_analysis_status": "'completed' | 'unavailable' | 'failed' | 'skipped'",
  "text_analysis_error": "string | null",
  "audio_duration_seconds": "float | null",
  "mood_label": "'frustrated' | 'neutral' | 'happy' | 'dejected' | 'unknown'",
  "mood_confidence": "float",
  "mood_source": "'combined' | 'voice' | 'transcript' | 'unknown'",
  "fatigue_label": "'high' | 'watch' | 'no_signal' | 'unknown'",
  "fatigue_confidence": "float",
  "fatigue_evidence": "string[]",
  "fatigue_status": "'screened' | 'skipped'"
}
```

The three services are intentionally independent. An unavailable provider therefore
returns a successful analysis response with a per-service status and safe retry
message, allowing the frontend to retry only that service.

Mood is the operator-facing summary of the completed voice and/or transcript
signals. Fatigue is a conservative screen for explicit tiredness or focus cues
in the transcript only; it is not a medical assessment.

## 3. LapPoint Object
Represents a single lap's timing data, optionally decorated with mood data if a labeled clip occurred during this lap.

```json
{
  "lap_number": "float",
  "lap_time": "float (seconds)",
  "delta_from_median": "float (seconds) | null",
  "clip_id": "string | null",
  "human_label": "string | null",
  "human_label_intensity": "integer | null",
  "is_ambiguous": "boolean | null"
}
```

## 4. LapChartResponse Object
Returned by `GET /api/laps` to render the lap time chart for a driver in a specific session.

```json
{
  "gp": "string",
  "session": "string",
  "driver_code": "string",
  "laps": [
    // Array of LapPoint objects
  ]
}
```
