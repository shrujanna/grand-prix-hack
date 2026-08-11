import os
import requests
from typing import Dict, Any

HF_API_KEY = os.environ.get("HF_API_KEY")
HF_AUDIO_MODEL_ID = os.environ.get("HF_AUDIO_MODEL_ID", "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition")
HF_API_URL = f"https://router.huggingface.co/hf-inference/models/{HF_AUDIO_MODEL_ID}"

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

def classify_audio_emotion(audio_bytes: bytes) -> Dict[str, Any]:
    """
    Sends audio bytes to Hugging Face Inference API and returns mapped emotion and confidence.
    """
    if not HF_API_KEY:
        raise ValueError("HF_API_KEY environment variable is not set.")

    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    
    response = requests.post(HF_API_URL, headers=headers, data=audio_bytes)
    
    if response.status_code != 200:
        raise Exception(f"Hugging Face API error {response.status_code}: {response.text}")

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
