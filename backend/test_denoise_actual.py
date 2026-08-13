import sys
import os

sys.path.append('.')
from app.services.audio_denoise import denoise_audio_bytes

audio_path = '../2026_f1_audio/NOR_1_20260704_123144.mp3'

if not os.path.exists(audio_path):
    print(f"File not found: {audio_path}")
    sys.exit(1)

print(f"Reading {audio_path}...")
with open(audio_path, 'rb') as f:
    raw_audio_bytes = f.read()

print(f"Read {len(raw_audio_bytes)} bytes of real MP3 audio.")
print("Running denoiser...")

try:
    cleaned_bytes = denoise_audio_bytes(raw_audio_bytes)
    print(f"Success! Denoiser returned {len(cleaned_bytes)} bytes of cleaned audio.")
except Exception as e:
    print(f"Error: {e}")
