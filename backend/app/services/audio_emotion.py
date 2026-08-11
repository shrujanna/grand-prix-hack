import os
import subprocess
import time
import requests
from typing import Dict, Any

DEFAULT_TIMEOUT_SECONDS = 30
RETRYABLE_STATUS_CODES = {429, 502, 503, 504}

# Map wav2vec2 emotion labels to our standard 4 project labels
EMOTION_MAPPING = {
    "anger": "frustrated",
    "angry": "frustrated",
    "disgust": "frustrated",
    "fear": "dejected",
    "sad": "dejected",
    "sadness": "dejected",
    "happy": "happy",
    "happiness": "happy",
    "surprise": "neutral",
    "neutral": "neutral"
}


def _clean_radio_audio(audio_bytes: bytes) -> bytes:
    """Make noisy team-radio audio more usable for a speech-emotion model.

    Formula 1 radio commonly contains engine noise, compression artefacts, and
    very uneven gain. This keeps speech frequencies, applies light denoising,
    limits peaks, and converts to mono 16 kHz WAV. If ffmpeg cannot decode a
    clip, the original bytes are still sent so analysis never becomes blocked.
    """
    if os.environ.get("AUDIO_DENOISE_ENABLED", "true").lower() in {"0", "false", "no"}:
        return audio_bytes
    try:
        process = subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", "pipe:0",
                "-af", "highpass=f=120,lowpass=f=7000,afftdn=nf=-25,alimiter=limit=0.95",
                "-ar", "16000", "-ac", "1", "-f", "wav", "pipe:1",
            ],
            input=audio_bytes,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
            timeout=20,
        )
        return process.stdout if process.returncode == 0 and len(process.stdout) > 512 else audio_bytes
    except (FileNotFoundError, subprocess.SubprocessError):
        return audio_bytes

def classify_audio_emotion(audio_bytes: bytes) -> Dict[str, Any]:
    """
    Sends audio bytes to Hugging Face Inference API and returns mapped emotion and confidence.
    """
    api_key = os.environ.get("HF_API_KEY") or os.environ.get("HF_TOKEN")
    if not api_key:
        raise ValueError("HF_API_KEY (or HF_TOKEN) environment variable is not set.")

    model_id = os.environ.get(
        "HF_AUDIO_MODEL_ID", "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition"
    )
    api_url = f"https://router.huggingface.co/hf-inference/models/{model_id}"
    try:
        timeout = float(os.environ.get("HF_INFERENCE_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS))
    except ValueError:
        timeout = DEFAULT_TIMEOUT_SECONDS

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/octet-stream"}
    prepared_audio = _clean_radio_audio(audio_bytes)
    response = None
    for attempt in range(3):
        try:
            response = requests.post(api_url, headers=headers, data=prepared_audio, timeout=timeout)
        except requests.RequestException as exc:
            if attempt == 2:
                raise RuntimeError("Audio-tone analysis provider could not be reached.") from exc
            time.sleep(2**attempt)
            continue
        if response.status_code not in RETRYABLE_STATUS_CODES or attempt == 2:
            break
        time.sleep(2**attempt)

    if response is None:
        raise RuntimeError("Audio-tone analysis provider did not return a response.")
    
    if response.status_code != 200:
        raise RuntimeError(f"Hugging Face API error {response.status_code}")

    # Response is typically a list of dicts with 'label' and 'score'
    results = response.json()
    if isinstance(results, list) and len(results) > 0:
        if isinstance(results[0], list): # Sometimes wrapped in an extra list
            results = results[0]
            
        # Sort by highest score
        sorted_results = sorted(results, key=lambda x: x.get("score", 0), reverse=True)
        top_result = sorted_results[0]
        
        raw_label = top_result.get("label", "neutral").lower()
        confidence = float(top_result.get("score", 0.0))
        
        # Apply mapping to project's unified mood scale
        mapped_label = EMOTION_MAPPING.get(raw_label, "neutral")
        
        return {
            "label": mapped_label,
            "confidence": confidence,
            "raw_label": raw_label
        }
    else:
        raise Exception(f"Unexpected response format from HF API: {results}")
