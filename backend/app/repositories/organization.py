"""Consultas de la organización: sus miembros, sus invitaciones y el plan que define su cupo
(DAT-05 a DAT-07, DAT-15 y DAT-16).

Todas corren con el contexto de la organización ya fijado: Row-Level Security deja ver solo
sus filas, y los filtros por organización de cada consulta son una segunda barrera.
"""

import datetime
import uuid
from dataclasses import dataclass

from sqlalchemy import ColumnElement, func, select, text
from sqlalchemy.orm import Session

from app.models import Invitation, Membership, Organization, Plan, Subscription, User


@dataclass(frozen=True, slots=True)
class MemberRow:
    """Un miembro con los datos que muestra la lista."""

    user_id: uuid.UUID
    full_name: str
    email: str
    role: str
    joined_at: datetime.datetime
    membership_id: uuid.UUID


def organization_for_update(session: Session, organization_id: uuid.UUID) -> Organization | None:
    """La organización con su fila bloqueada hasta el commit.

    Invitar la bloquea para que dos invitaciones simultáneas no ocupen a la vez el último cupo.
    """
    return session.get(Organization, organization_id, with_for_update=True)


def plan_of(session: Session, organization_id: uuid.UUID) -> Plan | None:
    """El plan de la suscripción de la organización, o None si no tiene suscripción."""
    statement = (
        select(Plan)
        .join(Subscription, Subscription.plan_id == Plan.id)
        .where(Subscription.organization_id == organization_id)
        .limit(1)
    )
    return session.scalar(statement)


def _open(now: datetime.datetime) -> ColumnElement[bool]:
    # Abierta: ni aceptada, ni revocada, ni vencida.
    return (
        Invitation.accepted_at.is_(None)
        & Invitation.revoked_at.is_(None)
        & (Invitation.expires_at > now)
    )


def member_count(session: Session, organization_id: uuid.UUID) -> int:
    """Cuántas personas pertenecen a la organización."""
    statement = select(func.count()).where(Membership.organization_id == organization_id)
    return session.scalar(statement) or 0


def open_invitation_count(
    session: Session, organization_id: uuid.UUID, now: datetime.datetime
) -> int:
    """Cuántas invitaciones siguen abiertas: cada una reserva un cupo hasta que vence."""
    statement = select(func.count()).where(
        Invitation.organization_id == organization_id, _open(now)
    )
    return session.scalar(statement) or 0


def is_member(session: Session, organization_id: uuid.UUID, email: str) -> bool:
    """Si alguien con ese correo ya pertenece a la organización, sin distinguir mayúsculas."""
    statement = (
        select(Membership.id)
        .join(User, User.id == Membership.user_id)
        .where(
            Membership.organization_id == organization_id,
            func.lower(User.email) == email.lower(),
        )
        .limit(1)
    )
    return session.scalar(statement) is not None


def has_open_invitation(
    session: Session, organization_id: uuid.UUID, email: str, now: datetime.datetime
) -> bool:
    """Si el correo ya tiene una invitación abierta en la organización."""
    statement = (
        select(Invitation.id)
        .where(
            Invitation.organization_id == organization_id,
            func.lower(Invitation.email) == email.lower(),
            _open(now),
        )
        .limit(1)
    )
    return session.scalar(statement) is not None


def add_invitation(session: Session, invitation: Invitation) -> None:
    """Guarda la invitación para que tenga identificador antes de auditarla."""
    session.add(invitation)
    session.flush()


def pending_invitation_for_update(
    session: Session, organization_id: uuid.UUID, invitation_id: uuid.UUID
) -> Invitation | None:
    """La invitación sin aceptar ni revocar, bloqueada hasta el commit, o None."""
    statement = (
        select(Invitation)
        .where(
            Invitation.id == invitation_id,
            Invitation.organization_id == organization_id,
            Invitation.accepted_at.is_(None),
            Invitation.revoked_at.is_(None),
        )
        .with_for_update()
    )
    return session.scalar(statement)


def pending_invitations(
    session: Session,
    organization_id: uuid.UUID,
    *,
    before: uuid.UUID | None,
    limit: int,
) -> list[Invitation]:
    """Invitaciones sin aceptar ni revocar, de la más reciente a la más antigua.

    Incluye las vencidas: quien administra ve que la persona no alcanzó a aceptarla. Pagina
    por cursor sobre el identificador, que es UUIDv7 y crece con el tiempo.
    """
    statement = select(Invitation).where(
        Invitation.organization_id == organization_id,
        Invitation.accepted_at.is_(None),
        Invitation.revoked_at.is_(None),
    )
    if before is not None:
        statement = statement.where(Invitation.id < before)
    statement = statement.order_by(Invitation.id.desc()).limit(limit)
    return list(session.scalars(statement))


def members(
    session: Session,
    organization_id: uuid.UUID,
    *,
    after: uuid.UUID | None,
    limit: int,
) -> list[MemberRow]:
    """Miembros en el orden en que llegaron: el propietario primero, porque creó la cuenta."""
    statement = (
        select(
            User.id,
            User.full_name,
            User.email,
            Membership.role,
            Membership.created_at,
            Membership.id,
        )
        .join(User, User.id == Membership.user_id)
        .where(Membership.organization_id == organization_id)
    )
    if after is not None:
        statement = statement.where(Membership.id > after)
    statement = statement.order_by(Membership.id).limit(limit)
    return [MemberRow(*row) for row in session.execute(statement)]


_INVITATION_FOR_TOKEN = text(
    "SELECT invitation_id, organization_id FROM invitation_for_token(:token_hash)"
)


def invitation_for_token(session: Session, token_hash: bytes) -> tuple[uuid.UUID, uuid.UUID] | None:
    """La invitación y su organización a partir del hash del token, sin contexto previo.

    Pasa por la función invitation_for_token (migración 0012): quien abre el enlace todavía no
    pertenece a la organización, así que Row-Level Security no le deja ver la fila.
    """
    row = session.execute(_INVITATION_FOR_TOKEN, {"token_hash": token_hash}).first()
    return (row.invitation_id, row.organization_id) if row is not None else None


def invitation_for_update(session: Session, invitation_id: uuid.UUID) -> Invitation | None:
    """La invitación bloqueada hasta el commit: dos aceptaciones del mismo enlace van en fila."""
    return session.get(Invitation, invitation_id, with_for_update=True)


def add_membership(session: Session, membership: Membership) -> None:
    """Guarda la membresía. La base rechaza una segunda membresía de la misma persona (RN-011)."""
    session.add(membership)
    session.flush()
