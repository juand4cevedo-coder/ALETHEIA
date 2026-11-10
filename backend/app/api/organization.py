"""Miembros e invitaciones de la organización (API-015 a API-021, HU-011 y HU-013).

Solo el propietario y el administrador entran aquí (RN-008): get_manager responde 403 a los
demás roles antes de tocar la base. Las respuestas llevan datos personales, así que ningún
intermediario guarda una copia.
"""

import uuid
from typing import Annotated, Any, Final

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_manager, get_session
from app.models import Invitation
from app.repositories.organization import MemberRow
from app.schemas.organization import (
    PAGE_SIZE_DEFAULT,
    PAGE_SIZE_MAX,
    InvitationOut,
    InvitationPage,
    InvitationRequest,
    MemberOut,
    MemberPage,
    RoleChangeRequest,
    SeatsOut,
)
from app.services import members as members_service
from app.services.sessions import Principal

router = APIRouter(prefix="/organization", tags=["organización"])

ALREADY_MEMBER: Final = "Esta persona ya es miembro de su organización."
INVITATION_OPEN: Final = (
    "Ya hay una invitación vigente para este correo. Si no le llegó, revóquela y envíe una nueva."
)
ORGANIZATION_NOT_ACTIVE: Final = (
    "Su organización está en solo lectura: puede consultar y exportar, pero no invitar "
    "personas hasta reactivar el plan."
)
OWNER_PROTECTED: Final = (
    "Nadie puede cambiar el rol del propietario ni retirarlo de la organización."
)
SELF_CHANGE: Final = (
    "No puede cambiar su propio rol ni retirarse a sí mismo. Pídaselo al propietario o a otro "
    "administrador."
)
# MSG-011: no revela si la invitación existe en otra organización.
NOT_FOUND: Final = "No encontramos lo que busca o no tiene acceso a ello."

type _Responses = dict[int | str, dict[str, Any]]

_FORBIDDEN: Final[_Responses] = {
    status.HTTP_403_FORBIDDEN: {"description": "No es propietario ni administrador."}
}
_UNAUTHORIZED: Final[_Responses] = {
    status.HTTP_401_UNAUTHORIZED: {"description": "No hay una sesión válida."}
}


def seat_limit_message(seats: members_service.Seats) -> str:
    """Explica el tope y cómo seguir: cambiar de plan o liberar una invitación (RN-012)."""
    users = "usuario" if seats.included == 1 else "usuarios"
    return (
        f"Su plan incluye {seats.included} {users} y ya están ocupados o invitados. Para "
        "invitar a alguien más, cambie de plan o revoque una invitación pendiente."
    )


def _seats_out(seats: members_service.Seats) -> SeatsOut:
    return SeatsOut(
        used=seats.used,
        included=seats.included,
        extra_user_price_cop=seats.extra_user_price_cop,
        full=seats.full,
    )


@router.get(
    "/members",
    summary="Miembros de la organización y cupo del plan",
    responses=_UNAUTHORIZED | _FORBIDDEN,
)
def list_members(
    response: Response,
    principal: Annotated[Principal, Depends(get_manager)],
    session: Annotated[Session, Depends(get_session)],
    cursor: Annotated[
        uuid.UUID | None, Query(description="next_cursor de la página anterior.")
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=PAGE_SIZE_MAX, description="Miembros por página.")
    ] = PAGE_SIZE_DEFAULT,
) -> MemberPage:
    response.headers["Cache-Control"] = "no-store"
    # Se pide uno de más para saber si hay otra página sin una segunda consulta.
    rows, seats = members_service.members(session, principal, after=cursor, limit=limit + 1)
    page = rows[:limit]
    return MemberPage(
        items=[_member_out(row) for row in page],
        next_cursor=page[-1].membership_id if len(rows) > limit else None,
        seats=_seats_out(seats),
    )


_MEMBER_ERRORS: Final[_Responses] = {
    status.HTTP_403_FORBIDDEN: {
        "description": (
            "No es propietario ni administrador, el miembro es el propietario o es uno mismo."
        )
    },
    status.HTTP_404_NOT_FOUND: {"description": "La persona no es miembro de la organización."},
}


def _member_errors(exc: Exception) -> HTTPException:
    if isinstance(exc, members_service.OwnerProtectedError):
        return HTTPException(status.HTTP_403_FORBIDDEN, detail=OWNER_PROTECTED)
    if isinstance(exc, members_service.SelfChangeError):
        return HTTPException(status.HTTP_403_FORBIDDEN, detail=SELF_CHANGE)
    return HTTPException(status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)


_MEMBER_EXCEPTIONS = (
    members_service.MemberNotFoundError,
    members_service.OwnerProtectedError,
    members_service.SelfChangeError,
)


@router.patch(
    "/members/{user_id}",
    summary="Cambiar el rol de un miembro",
    responses=_UNAUTHORIZED | _MEMBER_ERRORS,
)
def change_member_role(
    user_id: uuid.UUID,
    request: RoleChangeRequest,
    response: Response,
    principal: Annotated[Principal, Depends(get_manager)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> MemberOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        row = members_service.change_role(
            session, principal, user_id, request.role, client_ip=client_ip, user_agent=user_agent
        )
    except _MEMBER_EXCEPTIONS as exc:
        raise _member_errors(exc) from None
    return _member_out(row)


@router.delete(
    "/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Retirar a un miembro",
    responses=_UNAUTHORIZED | _MEMBER_ERRORS,
)
def remove_member(
    user_id: uuid.UUID,
    principal: Annotated[Principal, Depends(get_manager)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> None:
    try:
        members_service.remove_member(
            session, principal, user_id, client_ip=client_ip, user_agent=user_agent
        )
    except _MEMBER_EXCEPTIONS as exc:
        raise _member_errors(exc) from None


@router.post(
    "/invitations",
    status_code=status.HTTP_201_CREATED,
    summary="Invitar a una persona con un rol",
    responses=_UNAUTHORIZED
    | _FORBIDDEN
    | {
        status.HTTP_409_CONFLICT: {
            "description": (
                "Ya es miembro, ya tiene una invitación vigente, el plan no tiene cupo o la "
                "organización está en solo lectura."
            )
        },
        status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Demasiadas invitaciones seguidas."},
    },
)
def create_invitation(
    request: InvitationRequest,
    response: Response,
    principal: Annotated[Principal, Depends(get_manager)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> InvitationOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        invitation = members_service.invite(
            session,
            principal,
            request.email,
            request.role,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except members_service.AlreadyMemberError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=ALREADY_MEMBER) from None
    except members_service.InvitationAlreadyOpenError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=INVITATION_OPEN) from None
    except members_service.SeatLimitReachedError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=seat_limit_message(exc.seats)
        ) from None
    except members_service.OrganizationNotActiveError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=ORGANIZATION_NOT_ACTIVE) from None
    return _invitation_out(invitation)


@router.get(
    "/invitations",
    summary="Invitaciones pendientes",
    responses=_UNAUTHORIZED | _FORBIDDEN,
)
def list_invitations(
    response: Response,
    principal: Annotated[Principal, Depends(get_manager)],
    session: Annotated[Session, Depends(get_session)],
    cursor: Annotated[
        uuid.UUID | None, Query(description="next_cursor de la página anterior.")
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=PAGE_SIZE_MAX, description="Invitaciones por página.")
    ] = PAGE_SIZE_DEFAULT,
) -> InvitationPage:
    response.headers["Cache-Control"] = "no-store"
    invitations = members_service.pending_invitations(
        session, principal, before=cursor, limit=limit + 1
    )
    page = invitations[:limit]
    return InvitationPage(
        items=[_invitation_out(invitation) for invitation in page],
        next_cursor=page[-1].id if len(invitations) > limit else None,
    )


@router.delete(
    "/invitations/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revocar una invitación pendiente",
    responses=_UNAUTHORIZED
    | _FORBIDDEN
    | {status.HTTP_404_NOT_FOUND: {"description": "No hay una invitación pendiente con ese id."}},
)
def revoke_invitation(
    invitation_id: uuid.UUID,
    principal: Annotated[Principal, Depends(get_manager)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> None:
    try:
        members_service.revoke(
            session, principal, invitation_id, client_ip=client_ip, user_agent=user_agent
        )
    except members_service.InvitationNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=NOT_FOUND) from None


def _member_out(row: MemberRow) -> MemberOut:
    return MemberOut.model_validate(
        {
            "user_id": row.user_id,
            "full_name": row.full_name,
            "email": row.email,
            "role": row.role,
            "joined_at": row.joined_at,
        }
    )


def _invitation_out(invitation: Invitation) -> InvitationOut:
    return InvitationOut.model_validate(
        {
            "id": invitation.id,
            "email": invitation.email,
            "role": invitation.role,
            "invited_at": members_service.invited_at(invitation),
            "expires_at": invitation.expires_at,
            "expired": members_service.is_expired(invitation),
        }
    )
