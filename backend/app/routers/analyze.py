from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from app.models.schemas import AnalyzeResponse
from app.services.audio_emotion import classify_audio_emotion
from app.services.text_sentiment import classify_text_sentiment
import asyncio
import logging

router = APIRouter(
    prefix="/api/analyze",
    tags=["Analyze"]
)

logger = logging.getLogger(__name__)

@router.post("", response_model=AnalyzeResponse)
async def analyze_clip(
    audio: UploadFile = File(...),
    transcript: Optional[str] = Form(None)
):
    audio_bytes = await audio.read()
    
    # Run the Hugging Face services
    # We run them independently. If one fails, the other can still succeed.
    audio_label = "unknown"
    audio_confidence = 0.0
    text_label = None
    text_intensity = None
    
    try:
        audio_result = classify_audio_emotion(audio_bytes)
        audio_label = audio_result["label"]
        audio_confidence = audio_result["confidence"]
    except Exception as e:
        logger.error(f"Audio emotion service failed: {e}")
        audio_label = "error"
        
    if not transcript or not transcript.strip():
        try:
            logger.info("No transcript provided. Falling back to live transcription (ASR)...")
            from app.services.transcription import transcribe_audio
            transcript = transcribe_audio(audio_bytes)
        except Exception as e:
            logger.error(f"Live transcription service failed: {e}")
            transcript = "[TRANSCRIPT FAILED: The speech-to-text model could not process the audio.]"
            
    if transcript and not transcript.startswith("[TRANSCRIPT"):
        try:
            text_result = classify_text_sentiment(transcript)
            text_label = text_result["label"]
            text_intensity = text_result["intensity"]
        except Exception as e:
            logger.error(f"Text sentiment service failed: {e}")
            text_label = "error"

    return AnalyzeResponse(
        transcript=transcript,
        audio_model_label=audio_label,
        audio_model_confidence=audio_confidence,
        text_model_label=text_label,
        text_model_intensity=text_intensity
    )
