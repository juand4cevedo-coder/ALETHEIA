"""Abrir y aceptar una invitación (API-019 y API-052, HU-012).

Las dos rutas son públicas: quien abre el enlace todavía no tiene sesión en la organización.
El token viaja en el cuerpo de un POST, nunca en la dirección, para que no quede en registros
ni en la cabecera Referer. Ninguna respuesta se guarda en caché.
"""

from typing import Annotated, Any, Final

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.cookies import set_session_cookies
from app.api.deps import SESSION_CHALLENGE, get_app_settings, get_client_ip, get_session
from app.core.config import Settings
from app.schemas.invitations import (
    AcceptInvitationRequest,
    InvitationAccepted,
    InvitationPreview,
    InvitationTokenRequest,
)
from app.services import invitations as invitations_service
from app.services.legal import LegalVersionMismatchError

router = APIRouter(prefix="/invitations", tags=["invitaciones"])

INVALID_INVITATION: Final = (
    "Esta invitación ya no sirve: venció, ya se usó o la revocaron. Pida una nueva a quien le "
    "envió la invitación."
)
MEMBER_ELSEWHERE: Final = (
    "Su correo ya pertenece a una organización en ALETHEIA. Por ahora cada persona puede estar "
    "en una sola organización."
)
ORGANIZATION_NOT_ACTIVE: Final = (
    "La organización que le envió la invitación está en solo lectura y por ahora no puede "
    "sumar personas."
)
WRONG_CREDENTIAL_MESSAGE: Final = (
    "La contraseña no coincide con la de su cuenta. Revísela o recupérela."
)
MISSING_ACCOUNT_DATA: Final = (
    "Para crear su cuenta escriba su nombre y acepte los términos y la política de privacidad."
)
LEGAL_CHANGED: Final = (
    "Los términos o la política de privacidad cambiaron mientras los leía. Recargue la página "
    "y revise la versión vigente."
)

type _Responses = dict[int | str, dict[str, Any]]

_INVALID: Final[_Responses] = {
    status.HTTP_400_BAD_REQUEST: {"description": "La invitación ya no sirve."}
}
_LIMIT: Final[_Responses] = {
    status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Demasiados intentos seguidos."}
}


@router.post(
    "/preview",
    summary="Ver una invitación antes de aceptarla",
    responses=_INVALID | _LIMIT,
)
def preview_invitation(
    request: InvitationTokenRequest,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> InvitationPreview:
    response.headers["Cache-Control"] = "no-store"
    try:
        found = invitations_service.preview(session, request.token, client_ip=client_ip)
    except invitations_service.InvalidInvitationError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=INVALID_INVITATION) from None
    return InvitationPreview.model_validate(
        {
            "organization_name": found.organization_name,
            "inviter_name": found.inviter_name,
            "email": found.email,
            "role": found.role,
            "expires_at": found.expires_at,
            "account": found.account,
        }
    )


@router.post(
    "/accept",
    status_code=status.HTTP_201_CREATED,
    summary="Aceptar una invitación",
    responses=_INVALID
    | _LIMIT
    | {
        status.HTTP_201_CREATED: {
            "description": "Miembro creado: llegan las cookies de acceso y de renovación."
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "La cuenta existe y la contraseña no coincide."
        },
        status.HTTP_409_CONFLICT: {
            "description": (
                "El correo ya pertenece a una organización, la organización está en solo "
                "lectura o los textos legales cambiaron."
            )
        },
    },
)
def accept_invitation(
    request: AcceptInvitationRequest,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> InvitationAccepted:
    response.headers["Cache-Control"] = "no-store"
    new_account = (
        invitations_service.NewAccount(
            full_name=request.full_name, legal_version=request.legal_version or ""
        )
        if request.full_name is not None
        else None
    )
    try:
        accepted = invitations_service.accept(
            session,
            settings,
            request.token,
            request.password,
            new_account,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except invitations_service.InvalidInvitationError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=INVALID_INVITATION) from None
    except invitations_service.MissingAccountDataError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=MISSING_ACCOUNT_DATA) from None
    except invitations_service.WrongPasswordError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail=WRONG_CREDENTIAL_MESSAGE,
            headers={"WWW-Authenticate": SESSION_CHALLENGE, "Cache-Control": "no-store"},
        ) from None
    except invitations_service.MemberElsewhereError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=MEMBER_ELSEWHERE) from None
    except invitations_service.OrganizationNotActiveError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=ORGANIZATION_NOT_ACTIVE) from None
    except LegalVersionMismatchError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=LEGAL_CHANGED) from None
    set_session_cookies(response, accepted.session)
    return InvitationAccepted.model_validate(
        {"organization_name": accepted.organization_name, "role": accepted.role}
    )
