import sys
sys.path.append('.')
from app.services.audio_denoise import denoise_audio_bytes
try:
    with open('app/services/__init__.py', 'rb') as f:
        res = denoise_audio_bytes(f.read())
        print("Success")
except Exception as e:
    print(f"Error: {e}")
