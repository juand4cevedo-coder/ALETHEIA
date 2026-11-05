"""Perfil de quien tiene la sesión (API-014): quién es, su organización y su rol.

La interfaz lo consulta al abrir el espacio de trabajo para saber si hay sesión y a nombre de
quién está. HU-031 lo amplía con lo que muestra el espacio de trabajo.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_principal, get_session
from app.schemas.me import Me, OrganizationMembership
from app.services import accounts as accounts_service
from app.services.sessions import Principal

router = APIRouter(tags=["perfil"])


@router.get(
    "/me",
    summary="Perfil, organización y rol de quien tiene la sesión",
    responses={status.HTTP_401_UNAUTHORIZED: {"description": "No hay una sesión válida."}},
)
def read_me(
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
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
    )
