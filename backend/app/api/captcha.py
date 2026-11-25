"""Reto de la verificación de persona y la dependencia que lo exige (services/captcha.py)."""

import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_app_settings, get_session
from app.core.config import Settings
from app.schemas.captcha import CaptchaChallenge
from app.services import captcha as captcha_service

router = APIRouter(tags=["acceso"])

CAPTCHA_HEADER = "X-Aletheia-Captcha"


@router.get("/auth/captcha", summary="Reto de la verificación de persona")
def captcha_challenge(
    response: Response,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> CaptchaChallenge:
    response.headers["Cache-Control"] = "no-store"
    challenge = captcha_service.create(
        settings.signing_key(),
        settings.captcha_maxnumber,
        datetime.datetime.now(datetime.UTC),
    )
    return CaptchaChallenge.model_validate(challenge, from_attributes=True)


def require_captcha(
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    solution: Annotated[
        str | None,
        Header(
            alias=CAPTCHA_HEADER,
            description="Solución del reto de GET /auth/captcha, en JSON y Base64.",
        ),
    ] = None,
) -> None:
    """Exige una solución válida y sin usar, y la marca como usada de inmediato."""
    if not settings.captcha_required:
        return
    try:
        captcha_service.verify(
            session, settings.signing_key(), solution, datetime.datetime.now(datetime.UTC)
        )
        # Usada aunque el formulario falle después: un intento fallido también la gasta.
        session.commit()
    except captcha_service.CaptchaError:
        session.rollback()
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=(
                "No pudimos comprobar que es una persona. Espere a que termine la verificación "
                "e inténtelo de nuevo."
            ),
            headers={"Cache-Control": "no-store"},
        ) from None
