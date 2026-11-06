"""Perfil de quien tiene la sesión (API-014) y aceptación de los textos legales vigentes.

La interfaz consulta el perfil al abrir el espacio de trabajo para saber si hay sesión, a
nombre de quién está y si debe aceptar textos legales nuevos. HU-031 lo amplía con lo que
muestra el espacio de trabajo. Las dos rutas funcionan aunque la persona no haya aceptado los
textos vigentes: son justamente las que necesita para hacerlo.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_principal_allowing_outdated_legal, get_session
from app.core.legal import LEGAL_VERSION
from app.schemas.me import LegalAcceptanceRequest, LegalStatus, Me, OrganizationMembership
from app.services import accounts as accounts_service
from app.services import legal as legal_service
from app.services.sessions import Principal

router = APIRouter(tags=["perfil"])


@router.get(
    "/me",
    summary="Perfil, organización, rol y aceptación legal de quien tiene la sesión",
    responses={status.HTTP_401_UNAUTHORIZED: {"description": "No hay una sesión válida."}},
)
def read_me(
    response: Response,
    principal: Annotated[Principal, Depends(get_principal_allowing_outdated_legal)],
    session: Annotated[Session, Depends(get_session)],
) -> Me:
    # Datos personales: ni el navegador ni un intermediario guardan una copia.
    response.headers["Cache-Control"] = "no-store"
    profile = accounts_service.profile(session, principal)
    organization = (
        OrganizationMembership.model_validate(
            {"id": profile.organization.id, "name": profile.organization.name, "role": profile.role}
        )
        if profile.organization is not None
        else None
    )
    return Me(
        id=profile.user.id,
        full_name=profile.user.full_name,
        email=profile.user.email,
        email_verified=profile.user.email_verified_at is not None,
        organization=organization,
        legal=LegalStatus(
            accepted_version=principal.legal_version,
            current_version=LEGAL_VERSION,
            acceptance_required=not principal.accepted_current_legal,
        ),
    )


@router.post(
    "/me/legal-acceptance",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Aceptar los textos legales vigentes",
    responses={
        status.HTTP_204_NO_CONTENT: {
            "description": "Aceptación registrada, o ya estaba registrada para estos textos."
        },
        status.HTTP_401_UNAUTHORIZED: {"description": "No hay una sesión válida."},
        status.HTTP_409_CONFLICT: {
            "description": "Los textos cambiaron mientras la persona los leía; hay que recargar."
        },
    },
)
def accept_legal_terms(
    request: LegalAcceptanceRequest,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal_allowing_outdated_legal)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> None:
    response.headers["Cache-Control"] = "no-store"
    try:
        legal_service.accept_current(
            session,
            principal,
            request.legal_version,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except legal_service.LegalVersionMismatchError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Los términos o la política de privacidad cambiaron mientras los leía. Recargue "
                "la página y revise la versión vigente."
            ),
        ) from None
