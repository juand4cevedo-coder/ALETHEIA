"""Miembros e invitaciones de la organización (RF-014, RF-016, HU-011 y HU-013).

Solo el propietario y el administrador gestionan el equipo (RN-008); la API lo exige antes de
llegar aquí. Una invitación tiene un rol, sirve una sola vez, vence a las 72 horas y ocupa un
cupo del plan mientras siga abierta, así que nunca hay más personas e invitaciones abiertas de
las que el plan admite (RN-012). El plan Firma admite usuarios adicionales: para él el cupo
incluido no es un tope.

El enlace lleva un token opaco que se genera al enviar el correo y del que solo se guarda el
SHA-256 (ADR-035). Ni la base, ni la cola de tareas, ni los registros guardan el token.
"""

import datetime
import uuid
from dataclasses import dataclass
from typing import Final

from sqlalchemy.orm import Session

from app.core.permissions import has_permission
from app.core.tokens import new_opaque_token, opaque_token_hash
from app.models import AuditLog, Invitation, Membership, Plan
from app.repositories import organization as organization_repository
from app.repositories import sessions as sessions_repository
from app.repositories.organization import MemberRow
from app.services import jobs, rate_limit
from app.services.audit import audit_ip, audit_user_agent
from app.services.sessions import Principal

INVITATION_LIFETIME: Final = datetime.timedelta(hours=72)
INVITATION_TEMPLATE: Final = "invitation"
# Pantalla de aceptación (UI-011, HU-012). El token va en el fragmento (#t=…).
ACCEPT_PATH: Final = "/invitacion"

# Sin suscripción no hay plan del que saber el cupo: se niega como si solo cupiera una persona.
_FALLBACK_INCLUDED_USERS: Final = 1


@dataclass(frozen=True, slots=True)
class Seats:
    """Cupo de usuarios de la organización según su plan."""

    # Miembros más invitaciones abiertas.
    used: int
    included: int
    # Precio mensual de cada usuario adicional, o None si el plan no los admite.
    extra_user_price_cop: int | None

    @property
    def full(self) -> bool:
        """Si ya no cabe nadie más sin cambiar de plan."""
        return self.extra_user_price_cop is None and self.used >= self.included


class NotAManagerError(Exception):
    """Quien hace la petición no es propietario ni administrador de una organización."""


class OrganizationNotActiveError(Exception):
    """La organización está en solo lectura o suspendida."""


class AlreadyMemberError(Exception):
    """El correo ya es de un miembro de la organización."""


class InvitationAlreadyOpenError(Exception):
    """El correo ya tiene una invitación abierta en la organización."""


class SeatLimitReachedError(Exception):
    """El plan no admite más personas."""

    def __init__(self, seats: Seats) -> None:
        super().__init__("El plan no admite más personas.")
        self.seats = seats


class InvitationNotFoundError(Exception):
    """No hay una invitación pendiente con ese identificador en la organización."""


class MemberNotFoundError(Exception):
    """La persona no pertenece a la organización de quien hace la petición."""


class OwnerProtectedError(Exception):
    """Nadie cambia el rol del propietario ni lo retira (RN-010, CA-HU-013-02)."""


class SelfChangeError(Exception):
    """Quien administra no cambia su propio rol ni se retira a sí mismo desde aquí."""


def organization_of_manager(principal: Principal) -> uuid.UUID:
    """La organización de quien hace la petición, si la gestiona; si no, NotAManagerError."""
    if principal.organization_id is None or not has_permission(principal.role, "team.manage"):
        raise NotAManagerError
    return principal.organization_id


def seats(session: Session, organization_id: uuid.UUID, now: datetime.datetime) -> Seats:
    """Cupos usados e incluidos en el plan de la organización."""
    plan: Plan | None = organization_repository.plan_of(session, organization_id)
    used = organization_repository.member_count(
        session, organization_id
    ) + organization_repository.open_invitation_count(session, organization_id, now)
    if plan is None:
        return Seats(used=used, included=_FALLBACK_INCLUDED_USERS, extra_user_price_cop=None)
    return Seats(
        used=used, included=plan.included_users, extra_user_price_cop=plan.extra_user_price_cop
    )


def invite(
    session: Session,
    principal: Principal,
    email: str,
    role: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> Invitation:
    """Crea la invitación, la audita y encola su correo (API-016, CA-HU-011-01).

    Bloquea la organización mientras cuenta los cupos: dos invitaciones simultáneas no pueden
    ocupar a la vez el último (CA-HU-011-02).
    """
    organization_id = organization_of_manager(principal)
    # Cada invitación sale como un correo a una dirección que la persona elige: el tope por
    # cuenta impide usar ALETHEIA para enviar correos en masa (RNF-006).
    rate_limit.hit(session, rate_limit.INVITATION_ACCOUNT, str(principal.user_id))

    organization = organization_repository.organization_for_update(session, organization_id)
    if organization is None:  # authenticate acaba de encontrar su membresía.
        msg = "La organización de la sesión no existe"
        raise LookupError(msg)
    if organization.status != "active":
        session.rollback()
        raise OrganizationNotActiveError

    now = datetime.datetime.now(datetime.UTC)
    if organization_repository.is_member(session, organization_id, email):
        session.rollback()
        raise AlreadyMemberError
    if organization_repository.has_open_invitation(session, organization_id, email, now):
        session.rollback()
        raise InvitationAlreadyOpenError
    current = seats(session, organization_id, now)
    if current.full:
        session.rollback()
        raise SeatLimitReachedError(current)

    invitation = Invitation(
        organization_id=organization_id,
        email=email,
        role=role,
        # Hash de un valor que nadie conoce: la invitación no sirve hasta que sale su correo.
        token_hash=opaque_token_hash(new_opaque_token()),
        invited_by=principal.user_id,
        expires_at=now + INVITATION_LIFETIME,
    )
    organization_repository.add_invitation(session, invitation)
    _audit(session, principal, "invitation_sent", invitation.id, client_ip, user_agent, now)
    jobs.enqueue(
        session,
        "email_send",
        {
            "template": INVITATION_TEMPLATE,
            "invitation_id": str(invitation.id),
            "organization_id": str(organization_id),
        },
        f"{INVITATION_TEMPLATE}:{invitation.id}",
    )
    session.commit()
    return invitation


def revoke(
    session: Session,
    principal: Principal,
    invitation_id: uuid.UUID,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    """Revoca una invitación pendiente (API-018): su enlace deja de servir y libera el cupo.

    Una invitación de otra organización, aceptada, ya revocada o inexistente da el mismo
    InvitationNotFoundError, que no revela cuál de los casos es (RN-008).
    """
    organization_id = organization_of_manager(principal)
    invitation = organization_repository.pending_invitation_for_update(
        session, organization_id, invitation_id
    )
    if invitation is None:
        session.rollback()
        raise InvitationNotFoundError
    now = datetime.datetime.now(datetime.UTC)
    invitation.revoked_at = now
    _audit(session, principal, "invitation_revoked", invitation.id, client_ip, user_agent, now)
    session.commit()


def change_role(
    session: Session,
    principal: Principal,
    user_id: uuid.UUID,
    role: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> MemberRow:
    """Cambia el rol de un miembro (API-020, CA-HU-013-01).

    El cambio vale desde la petición siguiente de esa persona: su rol se lee de la base en cada
    petición, no del token. Repetir el mismo rol no cambia nada ni deja otro evento.
    """
    organization_id = organization_of_manager(principal)
    membership = _target(session, principal, organization_id, user_id)
    if membership.role != role:
        now = datetime.datetime.now(datetime.UTC)
        membership.role = role
        _audit(session, principal, "role_changed", user_id, client_ip, user_agent, now)
    session.flush()
    row = organization_repository.member_row(session, organization_id, user_id)
    session.commit()
    if row is None:  # La membresía acaba de leerse con su candado.
        msg = "El miembro desapareció dentro de la transacción"
        raise LookupError(msg)
    return row


def remove_member(
    session: Session,
    principal: Principal,
    user_id: uuid.UUID,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    """Retira a un miembro y cierra todas sus sesiones (API-021, CA-HU-013-01).

    La persona pierde el acceso en su petición siguiente: sus tokens de renovación quedan
    revocados y con ellos su sesión deja de valer, aunque su token de acceso no haya vencido.
    Su cuenta sigue existiendo: puede ingresar de nuevo, sin organización.
    """
    organization_id = organization_of_manager(principal)
    membership = _target(session, principal, organization_id, user_id)
    now = datetime.datetime.now(datetime.UTC)
    organization_repository.remove_membership(session, membership)
    sessions_repository.revoke_user_sessions(session, user_id, now)
    _audit(session, principal, "member_removed", user_id, client_ip, user_agent, now)
    session.commit()


def _target(
    session: Session, principal: Principal, organization_id: uuid.UUID, user_id: uuid.UUID
) -> Membership:
    """La membresía que se va a cambiar, con las reglas que la protegen."""
    membership = organization_repository.membership_for_update(session, organization_id, user_id)
    if membership is None:
        session.rollback()
        raise MemberNotFoundError
    if membership.role == "owner":
        session.rollback()
        raise OwnerProtectedError
    if user_id == principal.user_id:
        session.rollback()
        raise SelfChangeError
    return membership


def pending_invitations(
    session: Session, principal: Principal, *, before: uuid.UUID | None, limit: int
) -> list[Invitation]:
    """Invitaciones sin aceptar ni revocar, de la más reciente a la más antigua (API-017)."""
    organization_id = organization_of_manager(principal)
    return organization_repository.pending_invitations(
        session, organization_id, before=before, limit=limit
    )


def members(
    session: Session, principal: Principal, *, after: uuid.UUID | None, limit: int
) -> tuple[list[MemberRow], Seats]:
    """Miembros en el orden en que llegaron y el cupo del plan (API-015)."""
    organization_id = organization_of_manager(principal)
    now = datetime.datetime.now(datetime.UTC)
    rows = organization_repository.members(session, organization_id, after=after, limit=limit)
    return rows, seats(session, organization_id, now)


def invited_at(invitation: Invitation) -> datetime.datetime:
    """Cuándo se envió: toda invitación vence INVITATION_LIFETIME después de crearse."""
    return invitation.expires_at - INVITATION_LIFETIME


def is_expired(invitation: Invitation, now: datetime.datetime | None = None) -> bool:
    """Si la invitación ya venció."""
    return invitation.expires_at <= (now or datetime.datetime.now(datetime.UTC))


def accept_link(public_url: str, token: str) -> str:
    """Enlace de aceptación. El token va en el fragmento: el navegador nunca lo envía al
    servidor, así que no queda en los registros ni en la cabecera Referer."""
    return f"{public_url}{ACCEPT_PATH}#t={token}"


def _audit(
    session: Session,
    principal: Principal,
    action: str,
    target_id: uuid.UUID,
    client_ip: str,
    user_agent: str | None,
    now: datetime.datetime,
) -> None:
    session.add(
        AuditLog(
            organization_id=principal.organization_id,
            actor_user_id=principal.user_id,
            action=action,
            target_id=target_id,
            ip=audit_ip(client_ip),
            user_agent=audit_user_agent(user_agent),
            created_at=now,
        )
    )
    session.flush()
