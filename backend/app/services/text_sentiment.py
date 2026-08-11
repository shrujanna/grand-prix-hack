import os
import requests
from typing import Dict, Any

HF_API_KEY = os.environ.get("HF_API_KEY")
HF_TEXT_MODEL_ID = os.environ.get("HF_TEXT_MODEL_ID", "j-hartmann/emotion-english-distilroberta-base")
HF_API_URL = f"https://router.huggingface.co/hf-inference/models/{HF_TEXT_MODEL_ID}"

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
        
    if not HF_API_KEY:
        raise ValueError("HF_API_KEY environment variable is not set.")

    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    payload = {"inputs": text}
    
    response = requests.post(HF_API_URL, headers=headers, json=payload)
    
    if response.status_code != 200:
        raise Exception(f"Hugging Face API error {response.status_code}: {response.text}")

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
