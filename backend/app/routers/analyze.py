import asyncio
import logging
from typing import Optional, Set

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models.schemas import AnalyzeResponse
from app.services.audio_emotion import classify_audio_emotion
from app.services.audio_validation import AudioValidationError, validate_audio_upload
from app.services.text_sentiment import classify_text_sentiment
from app.services.transcription import (
    NoSpeechDetectedError,
    TranscriptionConfigurationError,
    transcribe_audio,
)


router = APIRouter(prefix="/api/analyze", tags=["Analyze"])
logger = logging.getLogger(__name__)
VALID_SERVICES = {"transcription", "audio", "text"}


def _requested_services(retry_services: Optional[str]) -> Set[str]:
    if not retry_services:
        return VALID_SERVICES.copy()
    requested = {item.strip().lower() for item in retry_services.split(",") if item.strip()}
    invalid = requested - VALID_SERVICES
    if invalid:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown analysis service: {', '.join(sorted(invalid))}.",
        )
    if not requested:
        raise HTTPException(status_code=422, detail="Select at least one service to retry.")
    return requested


def _service_error(service: str, error: Exception) -> tuple[str, str]:
    """Convert provider failures into safe UI messages and structured logs."""
    error_text = str(error)
    logger.warning(
        "analysis_service_failed service=%s error_type=%s error=%s",
        service,
        type(error).__name__,
        error_text,
    )
    if isinstance(error, TranscriptionConfigurationError) or "environment variable is not set" in error_text:
        return "unavailable", "Configure HF_TOKEN or HF_API_KEY, then retry this analysis."
    if isinstance(error, NoSpeechDetectedError):
        return "no_speech", "No intelligible speech was detected. Try a clearer radio clip."
    if "429" in error_text:
        return "unavailable", "The analysis provider is busy. Please retry in a moment."
    if "502" in error_text or "503" in error_text or "504" in error_text:
        return "unavailable", "The analysis provider is temporarily unavailable. Please retry."
    if "could not be reached" in error_text or "request failed" in error_text:
        return "unavailable", "The analysis provider could not be reached. Please retry."
    return "failed", "This analysis could not be completed. Please retry with a clear audio clip."


@router.post("", response_model=AnalyzeResponse)
async def analyze_clip(
    audio: UploadFile = File(...),
    transcript: Optional[str] = Form(None),
    retry_services: Optional[str] = Form(None),
):
    """Analyze an audio clip, with independent results for each AI service."""
    audio_bytes = await audio.read()
    try:
        duration = validate_audio_upload(audio_bytes, audio.content_type, audio.filename)
    except AudioValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    requested = _requested_services(retry_services)
    transcript = transcript.strip() if transcript and transcript.strip() else None

    response = {
        "transcript": transcript,
        "audio_model_label": "unknown",
        "audio_model_confidence": 0.0,
        "text_model_label": None,
        "text_model_intensity": None,
        "transcription_status": "provided" if transcript else "skipped",
        "transcription_error": None,
        "audio_analysis_status": "skipped",
        "audio_analysis_error": None,
        "text_analysis_status": "skipped",
        "text_analysis_error": None,
        "audio_duration_seconds": duration,
    }

    # The independent audio-tone and speech-to-text calls run concurrently.
    tasks = {}
    if "audio" in requested:
        tasks["audio"] = asyncio.to_thread(classify_audio_emotion, audio_bytes)
    if "transcription" in requested and not transcript:
        tasks["transcription"] = asyncio.to_thread(transcribe_audio, audio_bytes, audio.content_type)

    if tasks:
        task_names = list(tasks)
        results = await asyncio.gather(*tasks.values(), return_exceptions=True)
        for service, result in zip(task_names, results):
            if isinstance(result, Exception):
                status, message = _service_error(service, result)
                response[f"{service}_analysis_status" if service == "audio" else "transcription_status"] = status
                response[f"{service}_analysis_error" if service == "audio" else "transcription_error"] = message
                continue
            if service == "audio":
                response["audio_model_label"] = result["label"]
                response["audio_model_confidence"] = result["confidence"]
                response["audio_analysis_status"] = "completed"
            else:
                response["transcript"] = result
                response["transcription_status"] = "completed"

    # Text sentiment can only start once an actual transcript is available.
    if "text" in requested and response["transcript"]:
        try:
            text_result = await asyncio.to_thread(classify_text_sentiment, response["transcript"])
            response["text_model_label"] = text_result["label"]
            response["text_model_intensity"] = text_result["intensity"]
            response["text_analysis_status"] = "completed"
        except Exception as error:
            status, message = _service_error("text", error)
            response["text_analysis_status"] = status
            response["text_analysis_error"] = message
    elif "text" in requested and not response["transcript"]:
        response["text_analysis_status"] = "skipped"
        response["text_analysis_error"] = "Text sentiment needs a transcript first."

    return AnalyzeResponse(**response)
