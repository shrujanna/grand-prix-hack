import os
import requests
import json
from typing import Optional

HF_API_KEY = os.environ.get("HF_API_KEY")
HF_ASR_MODEL_ID = os.environ.get("HF_ASR_MODEL_ID", "openai/whisper-large-v3")
HF_API_URL = f"https://router.huggingface.co/hf-inference/models/{HF_ASR_MODEL_ID}"

def transcribe_audio(audio_bytes: bytes) -> Optional[str]:
    """
    Sends audio bytes to Hugging Face Inference API for Automatic Speech Recognition (ASR).
    Returns the transcribed text string.
    """
    if not HF_API_KEY:
        raise ValueError("HF_API_KEY environment variable is not set.")

    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    
    response = requests.post(HF_API_URL, headers=headers, data=audio_bytes)
    
    if response.status_code != 200:
        raise Exception(f"Hugging Face ASR API error {response.status_code}: {response.text}")

    result = response.json()
    
    if "text" in result:
        return result["text"].strip()
    
    # Sometimes HF inference returns an error indicating the model is loading
    if "error" in result:
        raise Exception(f"Hugging Face ASR API error: {result['error']}")
        
    return None
