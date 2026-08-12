from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models.schemas import Clip
from app.services.data_loader import get_all_clips, get_clip, filter_clips

router = APIRouter(
    prefix="/api/clips",
    tags=["Clips"]
)

@router.get("", response_model=List[Clip])
def list_clips(
    driver: Optional[str] = Query(None, description="Filter by 3-letter driver code (e.g. HAM)"),
    gp: Optional[str] = Query(None, description="Filter by Grand Prix name"),
    mood: Optional[str] = Query(None, description="Filter by explicit human mood label (e.g. frustrated)")
):
    if driver or gp or mood:
        return filter_clips(driver=driver, gp=gp, mood=mood)
    return get_all_clips()

@router.get("/{clip_id}", response_model=Clip)
def get_single_clip(clip_id: str):
    clip = get_clip(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    return clip
