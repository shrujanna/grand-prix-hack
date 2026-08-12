"""Explainable operator signals built from the available model outputs.

These helpers deliberately avoid diagnosing a driver's health. Fatigue is a
transcript cue screen: it can surface explicit self-reported fatigue language,
but an absence of cues is never treated as proof that a driver is rested.
"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional


MOOD_LABELS = {"frustrated", "neutral", "happy", "dejected"}

FATIGUE_CUES = (
    (r"\b(?:i am|i'm|im|feeling|feel)\s+(?:so\s+|really\s+|very\s+)?tired\b", 2, "self-reported tiredness"),
    (r"\b(?:i am|i'm|im|feeling|feel)\s+(?:so\s+|really\s+|very\s+)?exhausted\b", 3, "self-reported exhaustion"),
    (r"\b(?:i am|i'm|im|feeling|feel)\s+(?:so\s+|really\s+|very\s+)?drained\b", 2, "self-reported low energy"),
    (r"\b(?:i have|i've|ive)\s+no\s+energy\b", 3, "self-reported low energy"),
    (r"\b(?:i )?(?:can't|cannot)\s+(?:focus|concentrate)\b", 3, "difficulty focusing"),
    (r"\b(?:i am|i'm|im)\s+(?:losing|struggling with)\s+(?:focus|concentration)\b", 3, "difficulty concentrating"),
    (r"\b(?:i am|i'm|im|feel|feeling)\s+dizzy\b", 3, "self-reported dizziness"),
    (r"\b(?:my )?eyes? (?:are )?(?:going|closing|heavy)\b", 3, "eye-fatigue cue"),
)


def derive_mood(
    *,
    audio_label: Optional[str],
    audio_confidence: Optional[float],
    audio_status: str,
    text_label: Optional[str],
    text_intensity: Optional[int],
    text_status: str,
    audio_fallback: bool = False,
) -> Dict[str, Any]:
    """Produce one clear mood signal while retaining the source in the API."""
    voice_available = (
        not audio_fallback
        and audio_status == "completed"
        and audio_label in MOOD_LABELS
    )
    text_available = text_status == "completed" and text_label in MOOD_LABELS
    voice_confidence = min(1.0, max(0.0, float(audio_confidence or 0.0)))
    text_confidence = min(1.0, max(0.2, float(text_intensity or 1) / 5))

    if voice_available and text_available:
        if audio_label == text_label:
            return {
                "mood_label": audio_label,
                "mood_confidence": round((voice_confidence + text_confidence) / 2, 2),
                "mood_source": "combined",
            }
        # Word choice is more robust than prosody when a compressed radio is
        # noisy. The source still tells operators that models disagreed.
        return {
            "mood_label": text_label,
            "mood_confidence": round((text_confidence * 0.65) + (voice_confidence * 0.2), 2),
            "mood_source": "combined",
        }
    if text_available:
        return {"mood_label": text_label, "mood_confidence": round(text_confidence, 2), "mood_source": "transcript"}
    if voice_available:
        return {"mood_label": audio_label, "mood_confidence": round(voice_confidence, 2), "mood_source": "voice"}
    return {"mood_label": "unknown", "mood_confidence": 0.0, "mood_source": "unknown"}


def screen_fatigue_cues(transcript: Optional[str]) -> Dict[str, Any]:
    """Return a conservative fatigue cue screen based on explicit wording."""
    if not transcript or not transcript.strip():
        return {
            "fatigue_label": "unknown",
            "fatigue_confidence": 0.0,
            "fatigue_evidence": [],
            "fatigue_status": "skipped",
        }

    normalized = " ".join(transcript.lower().split())
    evidence = []
    score = 0
    for pattern, weight, description in FATIGUE_CUES:
        if re.search(pattern, normalized) and description not in evidence:
            evidence.append(description)
            score += weight

    if score >= 3:
        label = "high"
    elif score >= 1:
        label = "watch"
    else:
        label = "no_signal"

    return {
        "fatigue_label": label,
        "fatigue_confidence": round(min(0.95, score / 4), 2) if score else 0.0,
        "fatigue_evidence": evidence,
        "fatigue_status": "screened",
    }
