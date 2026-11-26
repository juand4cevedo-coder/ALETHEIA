"""Lo que la cuenta propietaria necesita para operar la plataforma, sin abrir expedientes.

Solo se leen datos comerciales y de operación: cuentas, despachos, suscripciones, comprobantes,
solicitudes y la cola de tareas. Ningún caso, evidencia, nota ni nombre de archivo sale de aquí.
"""

import datetime
import uuid
from dataclasses import dataclass
from typing import Final
from zoneinfo import ZoneInfo

from sqlalchemy import Date, case, cast, func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.models import (
    Job,
    Membership,
    Organization,
    PaymentEvent,
    PaymentReceipt,
    Plan,
    Subscription,
    SupportTicket,
    User,
)
from app.services.jobs import uuid7_floor

_BOGOTA: Final = ZoneInfo("America/Bogota")
_SOON: Final = datetime.timedelta(days=7)


@dataclass(frozen=True, slots=True)
class Expiring:
    organization_id: uuid.UUID
    organization_name: str
    plan_name: str
    access_source: str
    ends_at: datetime.datetime


@dataclass(frozen=True, slots=True)
class RecentAccount:
    id: uuid.UUID
    full_name: str
    email: str
    created_at: datetime.datetime


@dataclass(frozen=True, slots=True)
class Overview:
    accounts_total: int
    accounts_new_7_days: int
    accounts_new_30_days: int
    accounts_blocked: int
    organizations_total: int
    organizations_read_only: int
    subscriptions: dict[str, int]
    collected_30_days_cop: int
    receipts_30_days: int
    tickets_open: int
    tickets_overdue: int
    tickets_due_soon: int
    jobs_failed: int
    jobs_waiting: int
    payment_events_pending: int
    storage_used_bytes: int
    expiring: list[Expiring]
    recent_accounts: list[RecentAccount]


def _today() -> datetime.date:
    return datetime.datetime.now(_BOGOTA).date()


def overview(session: Session) -> Overview:
    now = session.execute(select(func.now())).scalar_one()
    accounts = session.execute(
        select(
            func.count(),
            func.count().filter(User.created_at >= now - datetime.timedelta(days=7)),
            func.count().filter(User.created_at >= now - datetime.timedelta(days=30)),
            func.count().filter(User.status == "blocked"),
        ).where(User.status != "closed", User.is_platform_admin.is_(False))
    ).one()
    organizations = session.execute(
        select(
            func.count(),
            func.count().filter(Organization.status == "read_only"),
            func.coalesce(func.sum(Organization.storage_used_bytes), 0),
        ).where(Organization.status != "closed")
    ).one()
    subscriptions = dict(
        session.execute(
            select(Subscription.status, func.count()).group_by(Subscription.status)
        ).all()
    )
    collected = session.execute(
        select(func.count(), func.coalesce(func.sum(PaymentReceipt.amount_cop), 0)).where(
            PaymentReceipt.issued_at >= now - datetime.timedelta(days=30)
        )
    ).one()
    today = _today()
    tickets = session.execute(
        select(
            func.count(),
            func.count().filter(SupportTicket.due_on < today),
            func.count().filter(SupportTicket.due_on.between(today, today + _SOON)),
        ).where(SupportTicket.status == "open")
    ).one()
    jobs = session.execute(
        select(
            func.count().filter(Job.status == "dead"),
            func.count().filter(Job.status.in_(("queued", "running"))),
        )
    ).one()
    pending_events = (
        session.scalar(
            select(func.count())
            .select_from(PaymentEvent)
            .where(PaymentEvent.processed_at.is_(None))
        )
        or 0
    )
    return Overview(
        accounts_total=int(accounts[0]),
        accounts_new_7_days=int(accounts[1]),
        accounts_new_30_days=int(accounts[2]),
        accounts_blocked=int(accounts[3]),
        organizations_total=int(organizations[0]),
        organizations_read_only=int(organizations[1]),
        subscriptions={str(key): int(value) for key, value in subscriptions.items()},
        collected_30_days_cop=int(collected[1]),
        receipts_30_days=int(collected[0]),
        tickets_open=int(tickets[0]),
        tickets_overdue=int(tickets[1]),
        tickets_due_soon=int(tickets[2]),
        jobs_failed=int(jobs[0]),
        jobs_waiting=int(jobs[1]),
        payment_events_pending=int(pending_events),
        storage_used_bytes=int(organizations[2]),
        expiring=_expiring(session, now),
        recent_accounts=[
            RecentAccount(
                id=user.id, full_name=user.full_name, email=user.email, created_at=user.created_at
            )
            for user in session.scalars(
                select(User)
                .where(User.status != "closed", User.is_platform_admin.is_(False))
                .order_by(User.created_at.desc())
                .limit(5)
            )
        ],
    )


def _ends_at() -> ColumnElement[datetime.datetime]:
    """Cuándo termina el acceso, según de dónde venga: prueba, cortesía o periodo pagado."""
    return case(
        (Subscription.access_source == "trial", Subscription.trial_ends_at),
        (Subscription.access_source == "courtesy", Subscription.courtesy_ends_at),
        else_=Subscription.current_period_end,
    )


def _expiring(session: Session, now: datetime.datetime) -> list[Expiring]:
    ends_at = _ends_at()
    rows = session.execute(
        select(Organization.id, Organization.name, Plan.name, Subscription.access_source, ends_at)
        .join(Subscription, Subscription.organization_id == Organization.id)
        .join(Plan, Plan.id == Subscription.plan_id)
        .where(
            Subscription.status.in_(("trial", "active", "past_due")),
            ends_at.between(now, now + _SOON),
        )
        .order_by(ends_at)
        .limit(8)
    ).all()
    return [
        Expiring(
            organization_id=row[0],
            organization_name=row[1],
            plan_name=row[2],
            access_source=row[3],
            ends_at=row[4],
        )
        for row in rows
    ]


@dataclass(frozen=True, slots=True)
class OrganizationRow:
    id: uuid.UUID
    name: str
    kind: str
    status: str
    owner_name: str | None
    owner_email: str | None
    members: int
    plan_name: str | None
    subscription_status: str | None
    access_source: str | None
    billing_cycle: str | None
    ends_at: datetime.datetime | None
    storage_used_bytes: int
    storage_limit_bytes: int | None
    created_at: datetime.datetime


@dataclass(frozen=True, slots=True)
class OrganizationPage:
    items: list[OrganizationRow]
    total: int
    next_cursor: uuid.UUID | None


PAGE_SIZE: Final = 25


def organizations(
    session: Session,
    *,
    search: str | None,
    subscription_status: str | None,
    cursor: uuid.UUID | None,
    kind: str | None = None,
) -> OrganizationPage:
    owner = (
        select(Membership.organization_id, User.full_name, User.email)
        .join(User, User.id == Membership.user_id)
        .where(Membership.role == "owner")
        .subquery()
    )
    members = (
        select(Membership.organization_id, func.count().label("members"))
        .group_by(Membership.organization_id)
        .subquery()
    )
    filters = [Organization.status != "closed"]
    if search:
        term = search.strip().lower()
        filters.append(
            or_(
                func.lower(Organization.name).contains(term, autoescape=True),
                func.lower(owner.c.email).contains(term, autoescape=True),
                func.lower(owner.c.full_name).contains(term, autoescape=True),
            )
        )
    if subscription_status:
        filters.append(Subscription.status == subscription_status)
    if kind:
        filters.append(Organization.kind == kind)
    base = (
        select(
            Organization,
            owner.c.full_name,
            owner.c.email,
            func.coalesce(members.c.members, 0),
            Plan.name,
            Plan.storage_limit_bytes,
            Subscription.status,
            Subscription.access_source,
            Subscription.billing_cycle,
            _ends_at(),
        )
        .outerjoin(owner, owner.c.organization_id == Organization.id)
        .outerjoin(members, members.c.organization_id == Organization.id)
        .outerjoin(Subscription, Subscription.organization_id == Organization.id)
        .outerjoin(Plan, Plan.id == Subscription.plan_id)
        .where(*filters)
    )
    total = session.scalar(select(func.count()).select_from(base.subquery())) or 0
    query = base.order_by(Organization.id.desc()).limit(PAGE_SIZE + 1)
    if cursor is not None:
        query = query.where(Organization.id < cursor)
    rows = session.execute(query).all()
    page = rows[:PAGE_SIZE]
    return OrganizationPage(
        items=[
            OrganizationRow(
                id=row[0].id,
                name=row[0].name,
                kind=row[0].kind,
                status=row[0].status,
                owner_name=row[1],
                owner_email=row[2],
                members=int(row[3]),
                plan_name=row[4],
                storage_limit_bytes=row[5],
                subscription_status=row[6],
                access_source=row[7],
                billing_cycle=row[8],
                ends_at=row[9],
                storage_used_bytes=row[0].storage_used_bytes,
                created_at=row[0].created_at,
            )
            for row in page
        ],
        total=int(total),
        next_cursor=page[-1][0].id if len(rows) > PAGE_SIZE else None,
    )


@dataclass(frozen=True, slots=True)
class JobKindRow:
    kind: str
    queued: int
    running: int
    failed: int
    done_24_hours: int
    oldest_waiting_at: datetime.datetime | None


@dataclass(frozen=True, slots=True)
class FailedJob:
    id: uuid.UUID
    kind: str
    attempts: int
    failed_at: datetime.datetime
    error: str | None


@dataclass(frozen=True, slots=True)
class Operations:
    kinds: list[JobKindRow]
    failed: list[FailedJob]
    payment_events_pending: int
    oldest_payment_event_at: datetime.datetime | None


def _error_class(message: str | None) -> str | None:
    """Solo el tipo de error, sin el mensaje: el mensaje puede llevar datos de una persona."""
    if not message:
        return None
    head = message.strip().splitlines()[0]
    name = head.split(":", 1)[0].strip()
    return name[:80] if name and " " not in name else "Error sin tipo"


def operations(session: Session) -> Operations:
    now = session.execute(select(func.now())).scalar_one()
    rows = session.execute(
        select(
            Job.kind,
            func.count().filter(Job.status == "queued"),
            func.count().filter(Job.status == "running"),
            func.count().filter(Job.status == "dead"),
            # Las tareas no guardan su creación: el UUID v7 la lleva en sus primeros bits.
            func.count().filter(
                Job.status == "done", Job.id >= uuid7_floor(now - datetime.timedelta(hours=24))
            ),
            func.min(Job.run_after).filter(Job.status == "queued"),
        )
        .group_by(Job.kind)
        .order_by(Job.kind)
    ).all()
    failed = session.execute(
        select(Job.id, Job.kind, Job.attempts, Job.run_after, Job.last_error)
        .where(Job.status == "dead")
        .order_by(Job.id.desc())
        .limit(20)
    ).all()
    pending = session.execute(
        select(func.count(), func.min(PaymentEvent.received_at)).where(
            PaymentEvent.processed_at.is_(None)
        )
    ).one()
    return Operations(
        kinds=[
            JobKindRow(
                kind=row[0],
                queued=int(row[1]),
                running=int(row[2]),
                failed=int(row[3]),
                done_24_hours=int(row[4]),
                oldest_waiting_at=row[5],
            )
            for row in rows
        ],
        failed=[
            FailedJob(
                id=row[0],
                kind=row[1],
                attempts=int(row[2]),
                failed_at=row[3],
                error=_error_class(row[4]),
            )
            for row in failed
        ],
        payment_events_pending=int(pending[0]),
        oldest_payment_event_at=pending[1],
    )


def signups_by_day(session: Session, days: int = 30) -> list[tuple[datetime.date, int]]:
    """Cuentas nuevas por día de Colombia, con los días sin registros en cero."""
    today = _today()
    start = today - datetime.timedelta(days=days - 1)
    local_day = cast(func.timezone("America/Bogota", User.created_at), Date)
    counts = dict(
        session.execute(
            select(local_day, func.count())
            .where(local_day >= start, User.is_platform_admin.is_(False))
            .group_by(local_day)
        ).all()
    )
    return [
        (day, int(counts.get(day, 0)))
        for day in (start + datetime.timedelta(days=offset) for offset in range(days))
    ]
