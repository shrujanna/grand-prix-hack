import os
import time
from typing import Any, Optional

import requests


DEFAULT_ASR_MODEL_ID = "openai/whisper-large-v3"
DEFAULT_TIMEOUT_SECONDS = 60
DEFAULT_MAX_RETRIES = 2
RETRYABLE_STATUS_CODES = {429, 502, 503, 504}


class TranscriptionConfigurationError(RuntimeError):
    """Raised when the service has not been configured with an ASR credential."""


class NoSpeechDetectedError(RuntimeError):
    """Raised when ASR completed but did not find intelligible speech."""


def _setting(name: str, default: str) -> str:
    """Read settings at call time so dotenv/test/runtime changes are respected."""
    return os.environ.get(name, default).strip()


def _response_error(response: Any) -> str:
    """Return a useful error without assuming the response body is JSON."""
    try:
        body = response.json()
    except (ValueError, TypeError):
        body = response.text

    if isinstance(body, dict):
        error = body.get("error") or body.get("message")
        if error:
            return str(error)
    return str(body).strip() or "unknown provider error"


def _retry_delay(response: Any, attempt: int) -> float:
    """Use provider hints when available, otherwise apply a short backoff."""
    retry_after = response.headers.get("Retry-After") if getattr(response, "headers", None) else None
    try:
        return min(float(retry_after), 10.0) if retry_after else min(2**attempt, 4.0)
    except (TypeError, ValueError):
        return min(2**attempt, 4.0)


def transcribe_audio(audio_bytes: bytes, content_type: Optional[str] = None) -> Optional[str]:
    """
    Sends audio bytes to Hugging Face Inference API for Automatic Speech Recognition (ASR).
    Returns the transcribed text string.
    """
    if not audio_bytes:
        raise ValueError("The uploaded audio file is empty.")

    # HF documents both names. Keep HF_API_KEY for this app while accepting
    # HF_TOKEN so deployments using the standard HF naming work as well.
    api_key = os.environ.get("HF_API_KEY") or os.environ.get("HF_TOKEN")
    if not api_key:
        raise TranscriptionConfigurationError(
            "HF_API_KEY (or HF_TOKEN) environment variable is not set."
        )

    model_id = _setting("HF_ASR_MODEL_ID", DEFAULT_ASR_MODEL_ID)
    api_url = _setting(
        "HF_ASR_API_URL",
        f"https://router.huggingface.co/hf-inference/models/{model_id}",
    )
    try:
        timeout = float(_setting("HF_ASR_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS)))
    except ValueError:
        timeout = DEFAULT_TIMEOUT_SECONDS
    try:
        max_retries = max(0, int(_setting("HF_ASR_MAX_RETRIES", str(DEFAULT_MAX_RETRIES))))
    except ValueError:
        max_retries = DEFAULT_MAX_RETRIES

    headers = {
        "Authorization": f"Bearer {api_key}",
        # Whisper accepts the uploaded audio bytes directly. Preserve the
        # browser's audio MIME type when available so the provider can decode
        # formats such as MP3 reliably.
        "Content-Type": content_type if content_type and content_type.startswith("audio/") else "application/octet-stream",
    }

    response = None
    for attempt in range(max_retries + 1):
        try:
            response = requests.post(
                api_url,
                headers=headers,
                data=audio_bytes,
                timeout=timeout,
            )
        except requests.RequestException as exc:
            if attempt >= max_retries:
                raise RuntimeError(f"Hugging Face ASR request failed: {exc}") from exc
            time.sleep(min(2**attempt, 4.0))
            continue

        if response.status_code not in RETRYABLE_STATUS_CODES or attempt >= max_retries:
            break
        time.sleep(_retry_delay(response, attempt))

    if response is None:  # Defensive guard for unusual/mocked request clients.
        raise RuntimeError("Hugging Face ASR request did not return a response.")
    if response.status_code != 200:
        raise RuntimeError(
            f"Hugging Face ASR API error {response.status_code}: {_response_error(response)}"
        )

    try:
        result = response.json()
    except (ValueError, TypeError) as exc:
        raise RuntimeError("Hugging Face ASR returned an invalid JSON response.") from exc

    if isinstance(result, dict):
        text = result.get("text") or result.get("generated_text")
        if isinstance(text, str) and text.strip():
            return text.strip()
        if result.get("error"):
            raise RuntimeError(f"Hugging Face ASR API error: {result['error']}")
    elif isinstance(result, list) and result:
        # A few providers wrap the standard ASR object in a one-item list.
        first = result[0]
        if isinstance(first, dict):
            text = first.get("text") or first.get("generated_text")
            if isinstance(text, str) and text.strip():
                return text.strip()

    raise NoSpeechDetectedError("No intelligible speech was detected in the uploaded audio.")
