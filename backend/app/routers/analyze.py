import asyncio
import logging
from typing import Optional, Set

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models.schemas import AnalyzeResponse
from app.services.audio_emotion import classify_audio_emotion
from app.services.audio_validation import AudioValidationError, validate_audio_upload
from app.services.live_clips import save_live_clip
from app.services.text_sentiment import classify_text_sentiment
from app.services.transcription import (
    NoSpeechDetectedError,
    TranscriptionConfigurationError,
    transcribe_audio,
)
from app.services.openf1 import OpenF1Error, download_team_radio, radio_context
from app.services.signal_assessment import derive_mood, screen_fatigue_cues


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
    if service == "audio":
        return "failed", "Voice tone could not be isolated after radio-noise cleanup. Transcript sentiment is still available; retry if you have a cleaner source."
    return "failed", "This analysis could not be completed. Please retry with a clear audio clip."


async def analyze_audio_bytes(
    audio_bytes: bytes,
    content_type: Optional[str],
    filename: Optional[str],
    transcript: Optional[str] = None,
    retry_services: Optional[str] = None,
    driver_code: Optional[str] = None,
    driver_name: Optional[str] = None,
    gp: Optional[str] = None,
    session: Optional[str] = None,
    lap_number: Optional[float] = None,
    save_clip: bool = True,
):
    """Run the shared analysis workflow for an uploaded or OpenF1 radio file."""
    try:
        duration = validate_audio_upload(audio_bytes, content_type, filename)
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
        "audio_fallback": False,
        "text_analysis_status": "skipped",
        "text_analysis_error": None,
        "audio_duration_seconds": duration,
        "mood_label": "unknown",
        "mood_confidence": 0.0,
        "mood_source": "unknown",
        "fatigue_label": "unknown",
        "fatigue_confidence": 0.0,
        "fatigue_evidence": [],
        "fatigue_status": "skipped",
    }

    # The independent audio-tone and speech-to-text calls run concurrently.
    tasks = {}
    if "audio" in requested:
        tasks["audio"] = asyncio.to_thread(classify_audio_emotion, audio_bytes)
    if "transcription" in requested and not transcript:
        tasks["transcription"] = asyncio.to_thread(transcribe_audio, audio_bytes, content_type)

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
            if response["audio_analysis_status"] in {"failed", "unavailable"}:
                # A noisy radio can still produce a trustworthy transcript.
                # Keep the distinction transparent, but provide a useful
                # fallback signal instead of leaving voice tone as unknown.
                response["audio_model_label"] = text_result["label"]
                response["audio_model_confidence"] = min(1.0, max(0.2, text_result["intensity"] / 5))
                response["audio_analysis_status"] = "estimated"
                response["audio_analysis_error"] = "Acoustic tone could not be isolated from radio noise; showing a transcript-derived estimate."
                response["audio_fallback"] = True
        except Exception as error:
            status, message = _service_error("text", error)
            response["text_analysis_status"] = status
            response["text_analysis_error"] = message
    elif "text" in requested and not response["transcript"]:
        response["text_analysis_status"] = "skipped"
        response["text_analysis_error"] = "Text sentiment needs a transcript first."

    response.update(
        derive_mood(
            audio_label=response["audio_model_label"],
            audio_confidence=response["audio_model_confidence"],
            audio_status=response["audio_analysis_status"],
            text_label=response["text_model_label"],
            text_intensity=response["text_model_intensity"],
            text_status=response["text_analysis_status"],
            audio_fallback=response["audio_fallback"],
        ),
        **screen_fatigue_cues(response["transcript"]),
    )

    # Original live uploads are saved for future review. Service-only retries
    # update the on-screen result without creating duplicate archive entries.
    if save_clip and not retry_services:
        metadata = {
            "driver_code": (driver_code or "LIVE").strip().upper() or "LIVE",
            "driver_name": (driver_name or driver_code or "Live upload").strip() or "Live upload",
            "gp": (gp or "Live uploads").strip() or "Live uploads",
            "session": (session or "Live").strip() or "Live",
            "lap_number": lap_number,
        }
        try:
            clip = await asyncio.to_thread(
                save_live_clip,
                audio_bytes=audio_bytes,
                content_type=content_type,
                filename=filename,
                metadata=metadata,
                analysis=response,
            )
            response.update(
                clip_id=clip.clip_id,
                gp=clip.gp,
                session=clip.session,
                driver_code=clip.driver_code,
                driver_name=clip.driver_name,
                lap_number=clip.lap_number,
                audio_url=clip.audio_url,
                source="live",
                uploaded_at=clip.uploaded_at,
            )
        except Exception as error:
            logger.exception("live_clip_save_failed error_type=%s", type(error).__name__)

    return AnalyzeResponse(**response)


@router.post("", response_model=AnalyzeResponse)
async def analyze_clip(
    audio: UploadFile = File(...),
    transcript: Optional[str] = Form(None),
    retry_services: Optional[str] = Form(None),
    driver_code: Optional[str] = Form(None),
    driver_name: Optional[str] = Form(None),
    gp: Optional[str] = Form(None),
    session: Optional[str] = Form(None),
    lap_number: Optional[float] = Form(None),
    save_clip: bool = Form(True),
):
    """Analyze an audio clip uploaded by the operator."""
    return await analyze_audio_bytes(
        await audio.read(), audio.content_type, audio.filename, transcript, retry_services,
        driver_code, driver_name, gp, session, lap_number, save_clip,
    )


@router.post("/openf1", response_model=AnalyzeResponse)
async def analyze_openf1_radio(
    session_key: int = Form(...),
    driver_number: int = Form(...),
    date: str = Form(...),
    lap_number: Optional[float] = Form(None),
):
    """Analyze a public OpenF1 recording while preserving its race metadata."""
    try:
        context = await asyncio.to_thread(radio_context, session_key, driver_number, date)
        audio_bytes, content_type, recording_url = await asyncio.to_thread(
            download_team_radio, session_key, driver_number, date
        )
    except OpenF1Error as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    result = await analyze_audio_bytes(
        audio_bytes=audio_bytes,
        content_type=content_type,
        filename=recording_url.rsplit("/", 1)[-1] or "team-radio.mp3",
        driver_code=context["driver_code"],
        driver_name=context["driver_name"],
        gp=context["gp"],
        session=context["session"],
        lap_number=lap_number,
        save_clip=True,
    )
    result.year = context.get("year")
    return result
