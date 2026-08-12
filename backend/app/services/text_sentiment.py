import os
import time
import requests
from typing import Dict, Any

DEFAULT_TIMEOUT_SECONDS = 30
RETRYABLE_STATUS_CODES = {429, 502, 503, 504}

EMOTION_MAPPING = {
    "anger": "frustrated",
    "disgust": "frustrated",
    "fear": "dejected",
    "sadness": "dejected",
    "joy": "happy",
    "surprise": "neutral",
    "neutral": "neutral"
}

def classify_text_sentiment(text: str) -> Dict[str, Any]:
    """
    Sends text to Hugging Face Inference API and returns mapped emotion and calculated intensity.
    The model natively evaluates word choice, profanity, and tone rather than race context.
    """
    if not text or not text.strip():
        return {"label": "neutral", "intensity": 1, "raw_label": "neutral"}
        
    api_key = os.environ.get("HF_API_KEY") or os.environ.get("HF_TOKEN")
    if not api_key:
        raise ValueError("HF_API_KEY (or HF_TOKEN) environment variable is not set.")

    model_id = os.environ.get(
        "HF_TEXT_MODEL_ID", "j-hartmann/emotion-english-distilroberta-base"
    )
    api_url = f"https://router.huggingface.co/hf-inference/models/{model_id}"
    try:
        timeout = float(os.environ.get("HF_INFERENCE_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS))
    except ValueError:
        timeout = DEFAULT_TIMEOUT_SECONDS

    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {"inputs": text}
    response = None
    for attempt in range(3):
        try:
            response = requests.post(api_url, headers=headers, json=payload, timeout=timeout)
        except requests.RequestException as exc:
            if attempt == 2:
                raise RuntimeError("Text-sentiment provider could not be reached.") from exc
            time.sleep(2**attempt)
            continue
        if response.status_code not in RETRYABLE_STATUS_CODES or attempt == 2:
            break
        time.sleep(2**attempt)

    if response is None:
        raise RuntimeError("Text-sentiment provider did not return a response.")
    
    if response.status_code != 200:
        raise RuntimeError(f"Hugging Face API error {response.status_code}")

    # Response is typically a list of lists of dicts with 'label' and 'score'
    results = response.json()
    if isinstance(results, list) and len(results) > 0:
        if isinstance(results[0], list):
            results = results[0]
            
        sorted_results = sorted(results, key=lambda x: x.get("score", 0), reverse=True)
        top_result = sorted_results[0]
        
        raw_label = top_result.get("label", "neutral").lower()
        confidence = float(top_result.get("score", 0.0))
        
        mapped_label = EMOTION_MAPPING.get(raw_label, "neutral")
        
        # Intensity heuristic: map model confidence (0.0 to 1.0) into a 1-5 scale.
        # This proxy assumes high confidence = strong signal/curtness/profanity expression.
        intensity = max(1, min(5, round(confidence * 5)))
        
        return {
            "label": mapped_label,
            "intensity": intensity,
            "raw_label": raw_label
        }
    else:
        raise Exception(f"Unexpected response format from HF API: {results}")
