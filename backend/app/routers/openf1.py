from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.services.openf1 import OpenF1Error, list_drivers, list_sessions, list_team_radio, map_radio_to_lap, radio_context


router = APIRouter(prefix="/api/openf1", tags=["OpenF1 radio archive"])


def _unavailable(error: OpenF1Error) -> HTTPException:
    return HTTPException(status_code=503, detail=str(error))


@router.get("/sessions")
def get_sessions(year: int = Query(..., ge=2023, le=2100)):
    try:
        return list_sessions(year)
    except OpenF1Error as error:
        raise _unavailable(error) from error


@router.get("/drivers")
def get_drivers(session_key: int = Query(...)):
    try:
        return list_drivers(session_key)
    except OpenF1Error as error:
        raise _unavailable(error) from error


@router.get("/radio")
def get_team_radio(
    session_key: int = Query(...),
    driver_number: Optional[int] = Query(None),
):
    try:
        return list_team_radio(session_key, driver_number)
    except OpenF1Error as error:
        raise _unavailable(error) from error


@router.get("/radio-context")
def get_radio_context(
    session_key: int = Query(...),
    driver_number: int = Query(...),
    date: str = Query(...),
):
    """Return a selected radio plus its best-effort FastF1 lap match."""
    try:
        context = radio_context(session_key, driver_number, date)
    except OpenF1Error as error:
        raise _unavailable(error) from error

    try:
        lap_number, lap_is_ambiguous = map_radio_to_lap(session_key, driver_number, date)
    except OpenF1Error:
        lap_number, lap_is_ambiguous = None, True

    return {**context, "lap_number": lap_number, "lap_is_ambiguous": lap_is_ambiguous}
