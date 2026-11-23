"""Tareas y plazos de trabajo dentro de casos asignados."""

import datetime
import uuid
from dataclasses import dataclass

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.permissions import has_permission
from app.models import AuditLog, Case, CaseMember, CaseTask, Membership, Organization, User
from app.schemas.tasks import CaseTaskCreate, TaskStatus
from app.services.audit import audit_ip, audit_user_agent
from app.services.members import OrganizationNotActiveError
from app.services.sessions import Principal


class TaskCaseNotFoundError(Exception):
    """El caso no existe o la persona no pertenece a él."""


class TaskNotFoundError(Exception):
    """La tarea no existe dentro de un caso visible para la persona."""


class TaskAssigneeNotFoundError(Exception):
    """La persona asignada no es miembro activo del caso."""


class TaskNotAllowedError(Exception):
    """El rol no puede realizar la operación solicitada."""


class ClosedCaseTaskError(Exception):
    """Un caso archivado conserva sus tareas, pero no admite cambios."""


@dataclass(frozen=True, slots=True)
class TaskView:
    task: CaseTask
    assignee_name: str


@dataclass(frozen=True, slots=True)
class InboxTaskView:
    task: CaseTask
    assignee_name: str
    case_title: str
    case_status: str


@dataclass(frozen=True, slots=True)
class TaskInbox:
    items: list[InboxTaskView]
    active: int
    overdue: int
    due_soon: int


def _member_case(session: Session, principal: Principal, case_id: uuid.UUID, *, lock: bool) -> Case:
    query = (
        select(Case)
        .join(CaseMember, CaseMember.case_id == Case.id)
        .where(Case.id == case_id, CaseMember.user_id == principal.user_id)
    )
    if lock:
        query = query.with_for_update(of=Case)
    case = session.scalar(query)
    if (
        case is None
        or principal.organization_id is None
        or case.organization_id != principal.organization_id
    ):
        raise TaskCaseNotFoundError
    return case


def _active_organization(session: Session, organization_id: uuid.UUID) -> None:
    if (
        session.scalar(select(Organization.status).where(Organization.id == organization_id))
        != "active"
    ):
        raise OrganizationNotActiveError


def list_tasks(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    *,
    cursor: uuid.UUID | None,
    status: TaskStatus | None,
    assigned_to: uuid.UUID | None,
    search: str | None,
    limit: int,
) -> tuple[list[TaskView], uuid.UUID | None]:
    _member_case(session, principal, case_id, lock=False)
    query = (
        select(CaseTask, User.full_name)
        .join(User, User.id == CaseTask.assigned_to)
        .where(CaseTask.case_id == case_id)
        .order_by(CaseTask.id.desc())
        .limit(limit + 1)
    )
    if cursor is not None:
        query = query.where(CaseTask.id < cursor)
    if status is not None:
        query = query.where(CaseTask.status == status)
    if assigned_to is not None:
        query = query.where(CaseTask.assigned_to == assigned_to)
    normalized = (search or "").strip().casefold()
    if normalized:
        query = query.where(func.lower(CaseTask.title).contains(normalized))
    rows = session.execute(query).all()
    page = rows[:limit]
    next_cursor = page[-1][0].id if len(rows) > limit else None
    return [TaskView(task, name) for task, name in page], next_cursor


def list_task_inbox(
    session: Session,
    principal: Principal,
    *,
    assigned_to: uuid.UUID | None,
    priority: str | None,
    due_before: datetime.datetime | None,
    search: str | None,
    limit: int,
) -> TaskInbox:
    """Trabajo activo de casos visibles; el asistente solo consulta su propia cola."""
    organization_id = principal.organization_id
    if organization_id is None:
        return TaskInbox([], 0, 0, 0)
    effective_assignee = principal.user_id if principal.role == "assistant" else assigned_to
    now = datetime.datetime.now(datetime.UTC)
    conditions = [
        CaseTask.organization_id == organization_id,
        Case.status == "open",
        CaseTask.status.in_(("pending", "in_progress")),
        CaseMember.user_id == principal.user_id,
    ]
    if effective_assignee is not None:
        conditions.append(CaseTask.assigned_to == effective_assignee)
    if priority is not None:
        conditions.append(CaseTask.priority == priority)
    if due_before is not None:
        conditions.append(CaseTask.due_at <= due_before)
    normalized = (search or "").strip().casefold()
    if normalized:
        conditions.append(
            func.lower(CaseTask.title).contains(normalized)
            | func.lower(Case.title).contains(normalized)
        )
    scope = (
        select(CaseTask.id)
        .join(Case, Case.id == CaseTask.case_id)
        .join(
            CaseMember,
            and_(
                CaseMember.case_id == Case.id,
                CaseMember.organization_id == Case.organization_id,
            ),
        )
        .where(*conditions)
    )
    totals = session.execute(
        select(
            func.count(CaseTask.id),
            func.count(CaseTask.id).filter(CaseTask.due_at < now),
            func.count(CaseTask.id).filter(
                and_(CaseTask.due_at >= now, CaseTask.due_at <= now + datetime.timedelta(days=7))
            ),
        ).where(CaseTask.id.in_(scope))
    ).one()
    rows = session.execute(
        select(CaseTask, User.full_name, Case.title, Case.status)
        .join(User, User.id == CaseTask.assigned_to)
        .join(Case, Case.id == CaseTask.case_id)
        .where(CaseTask.id.in_(scope))
        .order_by(CaseTask.due_at.asc().nulls_last(), CaseTask.id.desc())
        .limit(limit)
    ).all()
    return TaskInbox(
        items=[InboxTaskView(task, name, title, status) for task, name, title, status in rows],
        active=totals[0],
        overdue=totals[1],
        due_soon=totals[2],
    )


# Un mes visible cabe de sobra; el tope protege contra una consulta de años enteros.
CALENDAR_MAX_DAYS = 62
CALENDAR_MAX_ROWS = 500


class InvalidCalendarRangeError(Exception):
    """El periodo pedido es vacío, sin zona horaria o demasiado largo."""


@dataclass(frozen=True, slots=True)
class CalendarView:
    items: list[InboxTaskView]
    truncated: bool


def list_calendar(
    session: Session,
    principal: Principal,
    *,
    starts: datetime.datetime,
    ends: datetime.datetime,
) -> CalendarView:
    """Tareas con plazo dentro del periodo, de los casos abiertos que la persona ve.

    Incluye las ya completadas para que el calendario muestre qué se cumplió; las canceladas
    no. El asistente solo consulta su propia cola, igual que la bandeja.
    """
    if (
        starts.tzinfo is None
        or ends.tzinfo is None
        or starts >= ends
        or ends - starts > datetime.timedelta(days=CALENDAR_MAX_DAYS)
    ):
        raise InvalidCalendarRangeError
    organization_id = principal.organization_id
    if organization_id is None:
        return CalendarView([], truncated=False)
    conditions = [
        CaseTask.organization_id == organization_id,
        Case.status == "open",
        CaseTask.status.in_(("pending", "in_progress", "completed")),
        CaseTask.due_at >= starts,
        CaseTask.due_at < ends,
        CaseMember.user_id == principal.user_id,
    ]
    if principal.role == "assistant":
        conditions.append(CaseTask.assigned_to == principal.user_id)
    scope = (
        select(CaseTask.id)
        .join(Case, Case.id == CaseTask.case_id)
        .join(
            CaseMember,
            and_(
                CaseMember.case_id == Case.id,
                CaseMember.organization_id == Case.organization_id,
            ),
        )
        .where(*conditions)
    )
    rows = session.execute(
        select(CaseTask, User.full_name, Case.title, Case.status)
        .join(User, User.id == CaseTask.assigned_to)
        .join(Case, Case.id == CaseTask.case_id)
        .where(CaseTask.id.in_(scope))
        .order_by(CaseTask.due_at.asc(), CaseTask.id.asc())
        .limit(CALENDAR_MAX_ROWS + 1)
    ).all()
    return CalendarView(
        items=[
            InboxTaskView(task, name, title, status)
            for task, name, title, status in rows[:CALENDAR_MAX_ROWS]
        ],
        truncated=len(rows) > CALENDAR_MAX_ROWS,
    )


def create_task(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    data: CaseTaskCreate,
    *,
    client_ip: str,
    user_agent: str | None,
) -> TaskView:
    if not has_permission(principal.role, "cases.manage_tasks"):
        raise TaskNotAllowedError
    session.commit()
    with session.begin():
        case = _member_case(session, principal, case_id, lock=True)
        _active_organization(session, case.organization_id)
        if case.status != "open":
            raise ClosedCaseTaskError
        assignee = session.execute(
            select(User.id, User.full_name)
            .join(CaseMember, CaseMember.user_id == User.id)
            .join(
                Membership,
                (Membership.user_id == User.id)
                & (Membership.organization_id == case.organization_id),
            )
            .where(
                CaseMember.case_id == case.id,
                User.id == data.assigned_to,
                User.status == "active",
            )
        ).one_or_none()
        if assignee is None:
            raise TaskAssigneeNotFoundError
        task = CaseTask(
            organization_id=case.organization_id,
            case_id=case.id,
            title=data.title,
            description=data.description,
            priority=data.priority,
            due_at=data.due_at,
            assigned_to=data.assigned_to,
            created_by=principal.user_id,
        )
        session.add(task)
        session.flush()
        session.add(
            AuditLog(
                organization_id=case.organization_id,
                actor_user_id=principal.user_id,
                action="case_task_created",
                target_id=task.id,
                details={
                    "case_id": str(case.id),
                    "assigned_to": str(data.assigned_to),
                    "priority": data.priority,
                    "due_at": data.due_at.isoformat() if data.due_at else None,
                },
                ip=audit_ip(client_ip),
                user_agent=audit_user_agent(user_agent),
            )
        )
        session.flush()
    return TaskView(task, assignee.full_name)


def update_task_status(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    task_id: uuid.UUID,
    new_status: TaskStatus,
    *,
    client_ip: str,
    user_agent: str | None,
) -> TaskView:
    session.commit()
    with session.begin():
        case = _member_case(session, principal, case_id, lock=True)
        _active_organization(session, case.organization_id)
        if case.status != "open":
            raise ClosedCaseTaskError
        row = session.execute(
            select(CaseTask, User.full_name)
            .join(User, User.id == CaseTask.assigned_to)
            .where(CaseTask.id == task_id, CaseTask.case_id == case_id)
            .with_for_update(of=CaseTask)
        ).one_or_none()
        if row is None:
            raise TaskNotFoundError
        task, assignee_name = row
        manager = has_permission(principal.role, "cases.manage_tasks")
        assigned_worker = (
            has_permission(principal.role, "cases.complete_assigned_tasks")
            and task.assigned_to == principal.user_id
            and new_status != "canceled"
        )
        if not manager and not assigned_worker:
            raise TaskNotAllowedError
        if task.status != new_status:
            now = datetime.datetime.now(datetime.UTC)
            previous_status = task.status
            task.status = new_status
            task.updated_at = now
            task.completed_at = now if new_status == "completed" else None
            session.add(
                AuditLog(
                    organization_id=case.organization_id,
                    actor_user_id=principal.user_id,
                    action="case_task_status_changed",
                    target_id=task.id,
                    details={
                        "case_id": str(case.id),
                        "previous_status": previous_status,
                        "status": new_status,
                    },
                    ip=audit_ip(client_ip),
                    user_agent=audit_user_agent(user_agent),
                    created_at=now,
                )
            )
            session.flush()
    return TaskView(task, assignee_name)
