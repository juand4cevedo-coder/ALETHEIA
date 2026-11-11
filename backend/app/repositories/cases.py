"""Consultas de los casos: abrir uno, encontrarlo para un miembro, listar los de una persona
con su actividad, su equipo y sus últimos eventos de custodia (DAT-11, DAT-12 y DAT-15).

Todas corren con el contexto de la organización ya fijado: Row-Level Security deja ver solo
sus filas, y los filtros por organización y por miembro de cada consulta son una segunda barrera.
"""

import datetime
import uuid
from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import Select, func, select, true, tuple_
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.orm import Session, aliased, defer

from app.models import (
    AuditLog,
    Case,
    CaseMember,
    CustodyEvent,
    Evidence,
    Membership,
    Organization,
    User,
)
from app.models.evidence import DECLARED_TYPES


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


@dataclass(frozen=True, slots=True)
class CaseActivityRow:
    """Un caso de la lista con su actividad, tal como sale de member_cases."""

    case: Case
    created_by_name: str
    member_count: int
    # Nombres del equipo en el orden en que llegó.
    member_names: list[str]
    evidence_by_type: dict[str, int]
    last_action: str | None
    last_actor_name: str | None
    last_occurred_at: datetime.datetime | None
    # Las acciones de los últimos eventos, del más antiguo al más reciente.
    recent_actions: list[str]
    last_activity_at: datetime.datetime


@dataclass(frozen=True, slots=True)
class CaseTotalsRow:
    """Los totales de los casos de una persona."""

    open: int
    closed: int
    evidences: int
    pending_stamps: int
    custody_events: int


def _member_cases(
    organization_id: uuid.UUID, user_id: uuid.UUID, statuses: Sequence[str]
) -> Select[Case]:
    # Los casos de la organización donde la persona es miembro, en los estados pedidos.
    return (
        select(Case)
        .join(
            CaseMember,
            (CaseMember.case_id == Case.id)
            & (CaseMember.organization_id == Case.organization_id)
            & (CaseMember.user_id == user_id),
        )
        .where(Case.organization_id == organization_id, Case.status.in_(statuses))
    )


def member_cases(
    session: Session,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    statuses: Sequence[str],
    after: tuple[datetime.datetime, uuid.UUID] | None,
    limit: int,
    recent_actions: int,
) -> list[CaseActivityRow]:
    """Una página de los casos de la persona, de la actividad más reciente a la más antigua.

    Es una sola consulta para toda la página: cada dato por caso sale de una subconsulta
    lateral que usa los índices del caso (evidencias por caso, la cadena por (case_id, seq) y
    el equipo por case_id), así que el número de consultas no crece con el de casos. Una
    subconsulta interna elige primero los casos de la página por su último evento; los
    conteos solo se calculan para ellos.
    `after` es la (última actividad, id) del último caso de la página anterior.
    """
    creator = aliased(User)
    actor = aliased(User)
    member_user = aliased(User)
    team = aliased(CaseMember)

    last_event = (
        select(
            CustodyEvent.action,
            CustodyEvent.occurred_at,
            actor.full_name.label("actor_name"),
        )
        .outerjoin(actor, actor.id == CustodyEvent.actor_user_id)
        .where(CustodyEvent.case_id == Case.id)
        .order_by(CustodyEvent.seq.desc())
        .limit(1)
        .lateral("last_event")
    )
    # custody_seq es el número del último evento (lo avanza el trigger de la cadena): los
    # últimos n son los que tienen un número mayor que custody_seq - n.
    recent = (
        select(
            func.array_agg(aggregate_order_by(CustodyEvent.action, CustodyEvent.seq)).label(
                "actions"
            )
        )
        .where(
            CustodyEvent.case_id == Case.id,
            CustodyEvent.seq > Case.custody_seq - recent_actions,
        )
        .lateral("recent")
    )
    evidences = (
        select(
            *(
                func.count().filter(Evidence.declared_type == declared_type).label(declared_type)
                for declared_type in DECLARED_TYPES
            )
        )
        .where(Evidence.case_id == Case.id, Evidence.organization_id == Case.organization_id)
        .lateral("evidences")
    )
    members = (
        select(
            func.count().label("count"),
            func.array_agg(
                aggregate_order_by(member_user.full_name, team.added_at, member_user.id)
            ).label("names"),
        )
        .select_from(team)
        .join(member_user, member_user.id == team.user_id)
        .where(team.case_id == Case.id, team.organization_id == Case.organization_id)
        .lateral("members")
    )
    # Un caso sin eventos no debería existir; si existe, cuenta desde su apertura.
    last_activity_at = func.coalesce(last_event.c.occurred_at, Case.created_at)

    # Primero la página: ordenar exige la última actividad de todos los casos de la persona,
    # pero solo los de la página pagan los conteos de evidencias, equipo y acciones.
    page_ids = (
        _member_cases(organization_id, user_id, statuses)
        .with_only_columns(
            Case.id,
            last_event.c.action.label("last_action"),
            last_event.c.actor_name.label("last_actor_name"),
            last_event.c.occurred_at.label("last_occurred_at"),
            last_activity_at.label("last_activity_at"),
        )
        .outerjoin(last_event, true())
        .order_by(last_activity_at.desc(), Case.id.desc())
        .limit(limit)
    )
    if after is not None:
        page_ids = page_ids.where(tuple_(last_activity_at, Case.id) < tuple_(*after))
    page = page_ids.subquery("page")

    statement = (
        select(
            Case,
            creator.full_name.label("created_by_name"),
            members.c.count.label("member_count"),
            members.c.names.label("member_names"),
            *(
                evidences.c[declared_type].label(f"type_{declared_type}")
                for declared_type in DECLARED_TYPES
            ),
            page.c.last_action,
            page.c.last_actor_name,
            page.c.last_occurred_at,
            recent.c.actions.label("recent_actions"),
            page.c.last_activity_at,
        )
        .select_from(page)
        .join(Case, (Case.id == page.c.id) & (Case.organization_id == organization_id))
        .join(creator, creator.id == Case.created_by)
        .join(recent, true())
        .join(evidences, true())
        .join(members, true())
        .order_by(page.c.last_activity_at.desc(), page.c.id.desc())
        # La lista nunca necesita la llave envuelta: ni se lee ni se puede leer por error.
        .options(defer(Case.wrapped_key, raiseload=True))
    )

    rows: list[CaseActivityRow] = []
    for row in session.execute(statement):
        values = row._mapping
        by_type = {
            declared_type: values[f"type_{declared_type}"] for declared_type in DECLARED_TYPES
        }
        rows.append(
            CaseActivityRow(
                case=values[Case],
                created_by_name=values["created_by_name"],
                member_count=values["member_count"],
                member_names=list(values["member_names"] or []),
                evidence_by_type={kind: count for kind, count in by_type.items() if count},
                last_action=values["last_action"],
                last_actor_name=values["last_actor_name"],
                last_occurred_at=values["last_occurred_at"],
                recent_actions=list(values["recent_actions"] or []),
                last_activity_at=values["last_activity_at"],
            )
        )
    return rows


def member_case_totals(
    session: Session,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    statuses: Sequence[str],
) -> CaseTotalsRow:
    """Casos por estado, evidencias, sellos pendientes y eventos de los casos de la persona.

    Una sola consulta. Los eventos se cuentan con custody_seq, que es el número del último
    evento de cada caso: no hace falta recorrer la cadena.
    """
    mine = (
        _member_cases(organization_id, user_id, statuses)
        .with_only_columns(Case.id, Case.status, Case.custody_seq)
        .cte("mine")
    )
    cases_part = select(
        func.count().filter(mine.c.status == "open").label("open"),
        func.count().filter(mine.c.status == "closed").label("closed"),
        func.coalesce(func.sum(mine.c.custody_seq), 0).label("custody_events"),
    ).subquery("cases_part")
    evidences_part = (
        select(
            func.count().label("evidences"),
            func.count().filter(Evidence.tsa_status == "pending").label("pending_stamps"),
        )
        .join(mine, mine.c.id == Evidence.case_id)
        .where(Evidence.organization_id == organization_id)
        .subquery("evidences_part")
    )
    row = session.execute(
        select(
            cases_part.c.open,
            cases_part.c.closed,
            evidences_part.c.evidences,
            evidences_part.c.pending_stamps,
            cases_part.c.custody_events,
        ).select_from(cases_part.join(evidences_part, true()))
    ).one()
    return CaseTotalsRow(
        open=row.open,
        closed=row.closed,
        evidences=row.evidences,
        pending_stamps=row.pending_stamps,
        custody_events=int(row.custody_events),
    )


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
