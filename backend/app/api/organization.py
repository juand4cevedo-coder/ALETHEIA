"""Miembros e invitaciones de la organización (API-015 a API-021, HU-011 y HU-013).

Solo el propietario y el administrador entran aquí (RN-008): get_manager responde 403 a los
demás roles antes de tocar la base. Las respuestas llevan datos personales, así que ningún
intermediario guarda una copia.
"""

import datetime
import uuid
from typing import Annotated, Any, Final

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_manager, get_owner, get_session
from app.models import Invitation, Organization
from app.repositories.organization import MemberRow
from app.schemas.organization import (
    PAGE_SIZE_DEFAULT,
    PAGE_SIZE_MAX,
    InvitationOut,
    InvitationPage,
    InvitationRequest,
    MemberOut,
    MemberPage,
    OrganizationAuditAction,
    OrganizationAuditEvent,
    OrganizationAuditPage,
    OrganizationHealth,
    OrganizationOut,
    OrganizationPolicies,
    OrganizationPoliciesRequest,
    OrganizationRenameRequest,
    RoleChangeRequest,
    SeatsOut,
    SecurityIndicators,
)
from app.services import members as members_service
from app.services import organization as organization_service
from app.services import organization_audit
from app.services import organization_health as organization_health_service
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
        owner_exempt=seats.owner_exempt,
    )


def _organization_out(organization: Organization) -> OrganizationOut:
    return OrganizationOut(
        id=organization.id,
        name=organization.name,
        created_at=organization.created_at,
    )


@router.patch(
    "",
    summary="Cambiar el nombre del despacho",
    responses=_UNAUTHORIZED | _FORBIDDEN,
)
def rename_organization(
    request: OrganizationRenameRequest,
    response: Response,
    principal: Annotated[Principal, Depends(get_owner)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> OrganizationOut:
    response.headers["Cache-Control"] = "no-store"
    organization = organization_service.rename(
        session, principal, request.name, client_ip=client_ip, user_agent=user_agent
    )
    return _organization_out(organization)


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


@router.get(
    "/audit/export",
    summary="Exportar la auditoría de seguridad a CSV",
    response_class=Response,
    responses=_UNAUTHORIZED
    | _FORBIDDEN
    | {200: {"content": {"text/csv": {"schema": {"type": "string"}}}, "description": "CSV."}},
)
def organization_audit_export(
    principal: Annotated[Principal, Depends(get_manager)],
    session: Annotated[Session, Depends(get_session)],
    action: Annotated[
        OrganizationAuditAction | None,
        Query(description="Acción de seguridad exacta."),
    ] = None,
    actor: Annotated[uuid.UUID | None, Query(description="Persona que originó el evento.")] = None,
    created_from: Annotated[
        datetime.datetime | None,
        Query(description="Inicio inclusivo del periodo, con zona horaria."),
    ] = None,
    created_to: Annotated[
        datetime.datetime | None,
        Query(description="Fin exclusivo del periodo, con zona horaria."),
    ] = None,
) -> Response:
    for boundary in (created_from, created_to):
        if boundary is not None and boundary.tzinfo is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Las fechas de auditoría deben incluir zona horaria.",
            )
    if created_from is not None and created_to is not None and created_from >= created_to:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="El inicio del periodo debe ser anterior al final.",
        )
    rows = organization_audit.events(
        session,
        principal,
        after=None,
        limit=organization_audit.MAX_EXPORT_ROWS + 1,
        action=action.value if action is not None else None,
        actor=actor,
        created_from=created_from,
        created_to=created_to,
    )
    truncated = len(rows) > organization_audit.MAX_EXPORT_ROWS
    today = datetime.datetime.now(datetime.UTC).date().isoformat()
    return Response(
        content=organization_audit.to_csv(rows[: organization_audit.MAX_EXPORT_ROWS]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": f'attachment; filename="auditoria-aletheia-{today}.csv"',
            "X-Content-Type-Options": "nosniff",
            "X-Rows-Truncated": "1" if truncated else "0",
        },
    )


@router.get(
    "/audit",
    summary="Auditoría de seguridad de la organización",
    responses=_UNAUTHORIZED | _FORBIDDEN,
)
def organization_audit_page(
    response: Response,
    principal: Annotated[Principal, Depends(get_manager)],
    session: Annotated[Session, Depends(get_session)],
    cursor: Annotated[
        uuid.UUID | None, Query(description="next_cursor de la página anterior.")
    ] = None,
    limit: Annotated[int, Query(ge=1, le=PAGE_SIZE_MAX)] = PAGE_SIZE_DEFAULT,
    action: Annotated[
        OrganizationAuditAction | None,
        Query(description="Acción de seguridad exacta."),
    ] = None,
    actor: Annotated[
        uuid.UUID | None,
        Query(description="Persona que originó el evento."),
    ] = None,
    created_from: Annotated[
        datetime.datetime | None,
        Query(description="Inicio inclusivo del periodo, con zona horaria."),
    ] = None,
    created_to: Annotated[
        datetime.datetime | None,
        Query(description="Fin exclusivo del periodo, con zona horaria."),
    ] = None,
) -> OrganizationAuditPage:
    response.headers["Cache-Control"] = "no-store"
    for boundary in (created_from, created_to):
        if boundary is not None and boundary.tzinfo is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Las fechas de auditoría deben incluir zona horaria.",
            )
    if created_from is not None and created_to is not None and created_from >= created_to:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="El inicio del periodo debe ser anterior al final.",
        )
    rows = organization_audit.events(
        session,
        principal,
        after=cursor,
        limit=limit + 1,
        action=action.value if action is not None else None,
        actor=actor,
        created_from=created_from,
        created_to=created_to,
    )
    page = rows[:limit]
    return OrganizationAuditPage(
        items=[
            OrganizationAuditEvent(
                id=event.id,
                action=event.action,
                actor_user_id=event.actor_user_id,
                target_id=event.target_id,
                ip=str(event.ip) if event.ip is not None else None,
                user_agent=event.user_agent,
                created_at=event.created_at,
            )
            for event in page
        ],
        next_cursor=page[-1].id if len(rows) > limit else None,
    )


@router.get(
    "/health",
    summary="Salud del despacho: plan, almacenamiento, cupo y seguridad reciente",
    responses=_UNAUTHORIZED | _FORBIDDEN,
)
def organization_health(
    response: Response,
    principal: Annotated[Principal, Depends(get_manager)],
    session: Annotated[Session, Depends(get_session)],
) -> OrganizationHealth:
    response.headers["Cache-Control"] = "no-store"
    now = datetime.datetime.now(datetime.UTC)
    result = organization_health_service.health(session, principal, now)
    return OrganizationHealth(
        storage_used_bytes=result.storage_used_bytes,
        storage_limit_bytes=result.storage_limit_bytes,
        plan_name=result.plan_name,
        subscription_status=result.subscription_status,
        subscription_ends_at=result.subscription_ends_at,
        members=result.members,
        seats_included=result.seats_included,
        seats_used=result.seats_used,
        window_days=result.window_days,
        security=SecurityIndicators(**result.indicators),
    )


@router.get(
    "/policies",
    summary="Políticas del despacho: conservación de casos y duración de sesión",
    responses=_UNAUTHORIZED | _FORBIDDEN,
)
def get_policies(
    response: Response,
    principal: Annotated[Principal, Depends(get_manager)],
    session: Annotated[Session, Depends(get_session)],
) -> OrganizationPolicies:
    response.headers["Cache-Control"] = "no-store"
    organization = session.get(Organization, members_service.organization_of_manager(principal))
    if organization is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No encontramos su organización.")
    return OrganizationPolicies(
        default_retention_years=organization.default_retention_years,
        session_days=organization.session_days,
        require_two_factor=organization.require_two_factor,
    )


@router.put(
    "/policies",
    summary="Cambiar las políticas del despacho (solo el propietario)",
    responses=_UNAUTHORIZED | _FORBIDDEN,
)
def put_policies(
    request: OrganizationPoliciesRequest,
    response: Response,
    principal: Annotated[Principal, Depends(get_owner)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> OrganizationPolicies:
    response.headers["Cache-Control"] = "no-store"
    try:
        organization = organization_service.update_policies(
            session,
            principal,
            default_retention_years=request.default_retention_years,
            session_days=request.session_days,
            require_two_factor=request.require_two_factor,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except organization_service.TwoFactorSetupRequiredForPolicyError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Para exigirlo al equipo, primero active su propia verificación en dos pasos "
            "en Mi cuenta.",
        ) from None
    return OrganizationPolicies(
        default_retention_years=organization.default_retention_years,
        session_days=organization.session_days,
        require_two_factor=organization.require_two_factor,
    )
