import asyncio
import json
import wave
import sys
import os

# Create dummy wav
with wave.open("test.wav", "wb") as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(16000)
    f.writeframes(b"\x00" * 16000 * 2)

sys.path.insert(0, os.path.abspath("backend"))

from app.routers.analyze import analyze_audio_bytes

async def test():
    with open("test.wav", "rb") as f:
        audio = f.read()
    try:
        res = await analyze_audio_bytes(audio, "audio/wav", "test.wav", save_clip=False)
        print("Success!")
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(test())
