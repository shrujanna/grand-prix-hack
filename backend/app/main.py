from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

# Load environment variables (from .env if it exists)
load_dotenv()

app = FastAPI(
    title="F1 Team Radio Emotion Analysis API",
    description="Backend API for F1 Team Radio Emotion Analysis project",
    version="1.0.0"
)

# Enable CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok", "message": "Backend is running successfully."}

from app.routers import clips, analyze, laps, local_archive, openf1, telemetry, insights
from app.services.live_clips import upload_directory
from app.services.local_archive import archive_audio_directory
app.mount("/media", StaticFiles(directory=upload_directory()), name="media")
app.mount("/archive-audio", StaticFiles(directory=archive_audio_directory()), name="archive-audio")
app.include_router(clips.router)
app.include_router(analyze.router)
app.include_router(laps.router)
app.include_router(openf1.router)
app.include_router(local_archive.router)
app.include_router(telemetry.router)
app.include_router(insights.router)
