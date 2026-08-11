from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

from app.routers import clips, analyze, laps
app.include_router(clips.router)
app.include_router(analyze.router)
app.include_router(laps.router)
