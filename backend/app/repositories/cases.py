"""Consultas de los casos: abrir uno, encontrarlo para un miembro, su equipo y sus últimos
eventos de custodia (DAT-11, DAT-12 y DAT-15).

Todas corren con el contexto de la organización ya fijado: Row-Level Security deja ver solo
sus filas, y los filtros por organización y por miembro de cada consulta son una segunda barrera.
"""

import datetime
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog, Case, CaseMember, CustodyEvent, Membership, Organization, User


@dataclass(frozen=True, slots=True)
class CreatorState:
    """Lo que decide si una persona puede abrir un caso, además de su rol."""

    email_verified: bool
    organization_status: str | None


@dataclass(frozen=True, slots=True)
class CaseMemberView:
    """Un miembro del caso con los datos que muestra el detalle."""

    user_id: uuid.UUID
    full_name: str
    email: str
    role: str
    added_at: datetime.datetime


@dataclass(frozen=True, slots=True)
class CustodyEventView:
    """Un evento de la cadena con el nombre de quien lo hizo."""

    seq: int
    action: str
    actor_name: str | None
    occurred_at: datetime.datetime
    event_hash: bytes


def creator_state(session: Session, user_id: uuid.UUID, organization_id: uuid.UUID) -> CreatorState:
    """Si la persona verificó su correo y en qué estado está su organización."""
    verified_at = session.scalar(select(User.email_verified_at).where(User.id == user_id))
    status = session.scalar(select(Organization.status).where(Organization.id == organization_id))
    return CreatorState(email_verified=verified_at is not None, organization_status=status)


def creator_role_for_share(
    session: Session, user_id: uuid.UUID, organization_id: uuid.UUID
) -> tuple[str | None, str | None]:
    """El rol de la persona y el estado de la organización, bloqueados en modo compartido.

    Se leen dentro de la transacción que abre el caso: quitar a un miembro o cambiar su rol
    toma FOR UPDATE sobre la membresía, así que espera a que el caso quede abierto o lo ve
    después; lo mismo el cambio de estado de la organización. Sin membresía, el rol es None.
    """
    role = session.scalar(
        select(Membership.role)
        .where(Membership.organization_id == organization_id, Membership.user_id == user_id)
        .with_for_update(read=True)
    )
    status = session.scalar(
        select(Organization.status)
        .where(Organization.id == organization_id)
        .with_for_update(read=True)
    )
    return role, status


def add_case(
    session: Session,
    *,
    case: Case,
    member: CaseMember,
    event: CustodyEvent,
    audit: AuditLog,
) -> None:
    """Agrega el caso, la membresía de quien lo abre, su primer evento y la auditoría.

    El caso va primero: el trigger de la cadena lo bloquea y avanza su custody_seq.
    """
    session.add(case)
    session.flush()
    session.add_all([member, event, audit])
    session.flush()


def case_for_member(session: Session, case_id: uuid.UUID, user_id: uuid.UUID) -> Case | None:
    """El caso, si la persona es miembro de él; si no, None, igual que si no existiera."""
    statement = (
        select(Case)
        .join(CaseMember, CaseMember.case_id == Case.id)
        .where(Case.id == case_id, CaseMember.user_id == user_id)
    )
    return session.scalar(statement)


def user_name(session: Session, user_id: uuid.UUID) -> str:
    """El nombre completo de una persona."""
    return session.scalars(select(User.full_name).where(User.id == user_id)).one()


def case_members(
    session: Session, organization_id: uuid.UUID, case_id: uuid.UUID
) -> list[CaseMemberView]:
    """El equipo del caso en el orden en que llegó, con su rol en la organización."""
    statement = (
        select(User.id, User.full_name, User.email, Membership.role, CaseMember.added_at)
        .select_from(CaseMember)
        .join(User, User.id == CaseMember.user_id)
        .join(
            Membership,
            (Membership.user_id == CaseMember.user_id)
            & (Membership.organization_id == organization_id),
        )
        .where(CaseMember.case_id == case_id, CaseMember.organization_id == organization_id)
        .order_by(CaseMember.added_at, User.id)
    )
    return [CaseMemberView(*row) for row in session.execute(statement)]


def recent_events(session: Session, case_id: uuid.UUID, limit: int) -> list[CustodyEventView]:
    """Los últimos eventos de la cadena del caso, del más reciente al más antiguo (IDX-008)."""
    statement = (
        select(
            CustodyEvent.seq,
            CustodyEvent.action,
            User.full_name,
            CustodyEvent.occurred_at,
            CustodyEvent.event_hash,
        )
        .outerjoin(User, User.id == CustodyEvent.actor_user_id)
        .where(CustodyEvent.case_id == case_id)
        .order_by(CustodyEvent.seq.desc())
        .limit(limit)
    )
    return [CustodyEventView(*row) for row in session.execute(statement)]
