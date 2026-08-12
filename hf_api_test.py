import os
import requests
import sys

# Get token from env
HF_TOKEN = os.environ.get("HF_TOKEN")
if not HF_TOKEN:
    print("Please set HF_TOKEN environment variable.")
    sys.exit(1)

headers = {"Authorization": f"Bearer {HF_TOKEN}"}

# 1. Test Text Model
print("Testing Text Emotion Model...")
text_model = "j-hartmann/emotion-english-distilroberta-base"
text_url = f"https://api-inference.huggingface.co/models/{text_model}"
response = requests.post(text_url, headers=headers, json={"inputs": "I am so frustrated with this car!"})
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}\n")

# 2. Test Audio Model
print("Testing Audio Emotion Model...")
audio_model = "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition"
audio_url = f"https://api-inference.huggingface.co/models/{audio_model}"

# Read a sample audio file
sample_audio = "backend/app/data/audio/GAS_10_20260523_162550.mp3"
if not os.path.exists(sample_audio):
    print(f"Sample audio not found: {sample_audio}")
else:
    with open(sample_audio, "rb") as f:
        data = f.read()
    response = requests.post(audio_url, headers=headers, data=data)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
