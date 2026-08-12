"""Small, explainable links between radio state and subsequent lap pace.

These results deliberately describe an association, not a causal diagnosis.
They only use an already-associated radio lap and the driver's next recorded
lap, so an engineer can inspect the underlying clip before acting on it.
"""

from __future__ import annotations

from statistics import mean
from typing import Any, Dict, Iterable, List

from app.models.schemas import Clip


CONCERNING_MOODS = {"frustrated", "dejected"}
CONCERNING_FATIGUE = {"high", "watch"}


def _mood_for(clip: Clip) -> str | None:
    if clip.mood_label:
        return clip.mood_label
    return clip.human_label.value if clip.human_label else None


def _is_concerning(clip: Clip) -> bool:
    return _mood_for(clip) in CONCERNING_MOODS or clip.fatigue_label in CONCERNING_FATIGUE


def _reason_for(clip: Clip) -> str:
    reasons: List[str] = []
    mood = _mood_for(clip)
    if mood in CONCERNING_MOODS:
        reasons.append(mood)
    if clip.fatigue_label in CONCERNING_FATIGUE:
        reasons.append(f"fatigue {clip.fatigue_label}")
    return " + ".join(reasons) or "concerning radio"


def _context_notes(lap: Dict[str, Any]) -> List[str]:
    notes: List[str] = []
    if lap.get("is_pit_lap"):
        notes.append("pit lap")
    if lap.get("safety_car"):
        notes.append("safety-car or VSC")
    if lap.get("weather") == "rain":
        notes.append("rain")
    return notes


def _trend_enrichment(laps: List[Dict[str, Any]]) -> Dict[float, Dict[str, Any]]:
    """Calculate a three-lap rolling pace and signal changes in that trend."""
    enrichment: Dict[float, Dict[str, Any]] = {}
    prior_rolling: float | None = None
    for index, lap in enumerate(laps):
        window = laps[max(0, index - 2) : index + 1]
        rolling = mean(float(item["lap_time"]) for item in window)
        if len(window) < 3:
            trend = "warming_up"
        elif prior_rolling is None or abs(rolling - prior_rolling) < 0.08:
            trend = "stable"
        else:
            trend = "improving" if rolling < prior_rolling else "worsening"
        enrichment[float(lap["lap_number"])] = {
            "rolling_lap_time": round(rolling, 3),
            "pace_trend": trend,
        }
        prior_rolling = rolling
    return enrichment


def _stint_summaries(laps: List[Dict[str, Any]], clips: List[Clip]) -> List[Dict[str, Any]]:
    """Group laps between pit laps for a compact driver-state comparison."""
    clips_by_lap: Dict[float, List[Clip]] = {}
    for clip in clips:
        if clip.lap_number is not None:
            clips_by_lap.setdefault(float(clip.lap_number), []).append(clip)

    stints: List[List[Dict[str, Any]]] = [[]]
    for lap in laps:
        stints[-1].append(lap)
        if lap.get("is_pit_lap"):
            stints.append([])

    result: List[Dict[str, Any]] = []
    for index, stint in enumerate(stints, start=1):
        if not stint:
            continue
        stint_clips = [clip for lap in stint for clip in clips_by_lap.get(float(lap["lap_number"]), [])]
        moods = sorted({_mood_for(clip) for clip in stint_clips if _mood_for(clip)})
        result.append(
            {
                "stint_number": index,
                "start_lap": float(stint[0]["lap_number"]),
                "end_lap": float(stint[-1]["lap_number"]),
                "lap_count": len(stint),
                "average_lap_time": round(mean(float(lap["lap_time"]) for lap in stint), 3),
                "concerning_radio_events": sum(_is_concerning(clip) for clip in stint_clips),
                "mood_events": moods,
            }
        )
    return result


def build_performance_insights(laps: Iterable[Dict[str, Any]], clips: Iterable[Clip]) -> Dict[str, Any]:
    """Return a stable baseline, follow-up flags, and an honest association summary."""
    lap_rows = sorted((dict(lap) for lap in laps), key=lambda lap: lap["lap_number"])
    if not lap_rows:
        return {
            "baseline_lap_time": None,
            "radio_events": 0,
            "concerning_events": 0,
            "slower_followups": 0,
            "average_followup_delta": None,
            "flags": [],
            "summary": "No valid lap times are available for a pace comparison.",
        }

    lap_numbers = [float(lap["lap_number"]) for lap in lap_rows]
    by_number = {float(lap["lap_number"]): lap for lap in lap_rows}
    baseline_lap_time = mean(sorted(lap["lap_time"] for lap in lap_rows)[(len(lap_rows) - 1) // 2 : len(lap_rows) // 2 + 1])
    enrichment = _trend_enrichment(lap_rows)

    session_clips = [clip for clip in clips if clip.lap_number is not None]
    concerning_clips = [clip for clip in session_clips if _is_concerning(clip)]
    flags: List[Dict[str, Any]] = []

    for clip in concerning_clips:
        radio_lap = float(clip.lap_number)
        followup_lap = next((number for number in lap_numbers if number > radio_lap), None)
        if followup_lap is None:
            continue
        followup = by_number[followup_lap]
        delta = float(followup["lap_time"]) - baseline_lap_time
        context_notes = _context_notes(followup)
        flags.append(
            {
                "clip_id": clip.clip_id,
                "radio_lap": radio_lap,
                "followup_lap": followup_lap,
                "mood_label": _mood_for(clip),
                "fatigue_label": clip.fatigue_label,
                "reason": _reason_for(clip),
                "followup_delta": round(delta, 3),
                "followup_is_slower": delta > 0,
                "context_category": "race_condition" if context_notes else "driver_state_signal",
                "context_notes": context_notes,
            }
        )

    slower_followups = sum(flag["followup_is_slower"] for flag in flags)
    average_followup_delta = round(mean(flag["followup_delta"] for flag in flags), 3) if flags else None
    if not concerning_clips:
        summary = "No frustrated, dejected, or fatigue-cue radio events are associated with this session."
    elif not flags:
        summary = "Concerning radio events occur on the final recorded lap, so there is no following lap to compare."
    elif average_followup_delta is not None and average_followup_delta > 0:
        summary = (
            f"Concerning radio events were followed by laps {average_followup_delta:.3f}s slower than the "
            f"session median ({slower_followups}/{len(flags)} slower follow-ups). Association only—not causation."
        )
    elif average_followup_delta is not None:
        summary = (
            f"Concerning radio events were followed by laps {abs(average_followup_delta):.3f}s faster than the "
            f"session median ({slower_followups}/{len(flags)} slower follow-ups). Association only—not causation."
        )
    else:
        summary = "No pace comparison is available for the associated radio events."

    clips_by_lap: Dict[float, List[Clip]] = {}
    for clip in session_clips:
        clips_by_lap.setdefault(float(clip.lap_number), []).append(clip)
    timeline = []
    for lap in lap_rows:
        lap_number = float(lap["lap_number"])
        clips_on_lap = clips_by_lap.get(lap_number, [])
        primary_clip = clips_on_lap[0] if clips_on_lap else None
        timeline.append(
            {
                "lap_number": lap_number,
                "lap_time": round(float(lap["lap_time"]), 3),
                "delta_from_median": round(float(lap["lap_time"]) - baseline_lap_time, 3),
                "pace_trend": enrichment[lap_number]["pace_trend"],
                "clip_id": primary_clip.clip_id if primary_clip else None,
                "mood_label": _mood_for(primary_clip) if primary_clip else None,
                "fatigue_label": primary_clip.fatigue_label if primary_clip else None,
                "race_context": _context_notes(lap),
            }
        )

    return {
        "baseline_lap_time": round(baseline_lap_time, 3),
        "radio_events": len(session_clips),
        "concerning_events": len(concerning_clips),
        "slower_followups": slower_followups,
        "average_followup_delta": average_followup_delta,
        "fastest_lap_time": round(min(float(lap["lap_time"]) for lap in lap_rows), 3),
        "average_lap_time": round(mean(float(lap["lap_time"]) for lap in lap_rows), 3),
        "slowest_lap_time": round(max(float(lap["lap_time"]) for lap in lap_rows), 3),
        "flags": flags,
        "timeline": timeline,
        "stints": _stint_summaries(lap_rows, session_clips),
        "lap_enrichment": enrichment,
        "summary": summary,
    }
