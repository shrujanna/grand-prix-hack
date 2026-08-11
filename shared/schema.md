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
  "text_model_label": "string | null",
  "lap_number": "float | null",
  "lap_is_ambiguous": "boolean | null",
  "audio_url": "string"
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
  "text_model_intensity": "integer | null"
}
```

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
