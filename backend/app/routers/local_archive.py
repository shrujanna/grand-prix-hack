from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.services import local_archive

router = APIRouter(prefix="/api/local-archive", tags=["Local 2026 radio archive"])


def _handle(error: local_archive.LocalArchiveError):
    raise HTTPException(status_code=503, detail=str(error)) from error


@router.get("/sessions")
def sessions(year: int = Query(...)):
    try:
        return local_archive.list_sessions(year)
    except local_archive.LocalArchiveError as error:
        _handle(error)


@router.get("/drivers")
def drivers(session_key: int = Query(...)):
    try:
        return local_archive.list_drivers(session_key)
    except local_archive.LocalArchiveError as error:
        _handle(error)


@router.get("/radio")
def radio(session_key: int = Query(...), driver_number: Optional[int] = Query(None)):
    try:
        return local_archive.list_team_radio(session_key, driver_number)
    except local_archive.LocalArchiveError as error:
        _handle(error)


@router.get("/radio-context")
def context(clip_id: str = Query(...)):
    try:
        return local_archive.radio_context(clip_id)
    except local_archive.LocalArchiveError as error:
        _handle(error)
