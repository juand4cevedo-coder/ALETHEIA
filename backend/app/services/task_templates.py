"""Plantillas de tareas: crear, listar, borrar y aplicar a un caso."""

import datetime
import uuid
import zoneinfo
from dataclasses import dataclass

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.permissions import has_permission
from app.models import (
    AuditLog,
    CaseMember,
    CaseTask,
    Membership,
    TaskTemplate,
    TaskTemplateItem,
    User,
)
from app.schemas.task_templates import TaskTemplateCreate
from app.services.audit import audit_ip, audit_user_agent
from app.services.sessions import Principal
from app.services.tasks import (
    ClosedCaseTaskError,
    TaskAssigneeNotFoundError,
    TaskNotAllowedError,
    TaskView,
    _active_organization,
    _member_case,
)

_BOGOTA = zoneinfo.ZoneInfo("America/Bogota")
# Los plazos de una plantilla vencen al cierre de la jornada, no a la hora en que se aplica.
_DUE_HOUR = 17


class TemplateNotFoundError(Exception):
    """La plantilla no existe en este despacho."""


class TemplateNameTakenError(Exception):
    """Ya hay una plantilla con ese nombre en el despacho."""


@dataclass(frozen=True, slots=True)
class TemplateView:
    template: TaskTemplate
    items: list[TaskTemplateItem]


def _require_manager(principal: Principal) -> uuid.UUID:
    if principal.organization_id is None or not has_permission(
        principal.role, "cases.manage_tasks"
    ):
        raise TaskNotAllowedError
    return principal.organization_id


def _items_of(
    session: Session, template_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[TaskTemplateItem]]:
    grouped: dict[uuid.UUID, list[TaskTemplateItem]] = {
        template_id: [] for template_id in template_ids
    }
    if not template_ids:
        return grouped
    rows = session.scalars(
        select(TaskTemplateItem)
        .where(TaskTemplateItem.template_id.in_(template_ids))
        .order_by(TaskTemplateItem.template_id, TaskTemplateItem.position)
    )
    for item in rows:
        grouped[item.template_id].append(item)
    return grouped


def list_templates(session: Session, principal: Principal) -> list[TemplateView]:
    organization_id = _require_manager(principal)
    templates = list(
        session.scalars(
            select(TaskTemplate)
            .where(TaskTemplate.organization_id == organization_id)
            .order_by(func.lower(TaskTemplate.name))
        )
    )
    grouped = _items_of(session, [template.id for template in templates])
    return [TemplateView(template, grouped[template.id]) for template in templates]


def _audit(
    session: Session,
    principal: Principal,
    action: str,
    template_id: uuid.UUID,
    name: str,
    *,
    client_ip: str,
    user_agent: str | None,
    extra: dict[str, str | int] | None = None,
) -> None:
    session.add(
        AuditLog(
            organization_id=principal.organization_id,
            actor_user_id=principal.user_id,
            action=action,
            target_id=template_id,
            details={"name": name, **(extra or {})},
            ip=audit_ip(client_ip),
            user_agent=audit_user_agent(user_agent),
        )
    )


def _build_items(
    organization_id: uuid.UUID, template_id: uuid.UUID, data: TaskTemplateCreate
) -> list[TaskTemplateItem]:
    return [
        TaskTemplateItem(
            organization_id=organization_id,
            template_id=template_id,
            position=position,
            title=item.title,
            description=item.description,
            priority=item.priority,
            due_days=item.due_days,
        )
        for position, item in enumerate(data.items, start=1)
    ]


def create_template(
    session: Session,
    principal: Principal,
    data: TaskTemplateCreate,
    *,
    client_ip: str,
    user_agent: str | None,
) -> TemplateView:
    organization_id = _require_manager(principal)
    session.commit()
    try:
        with session.begin():
            template = TaskTemplate(
                organization_id=organization_id, name=data.name, created_by=principal.user_id
            )
            session.add(template)
            session.flush()
            items = _build_items(organization_id, template.id, data)
            session.add_all(items)
            _audit(
                session,
                principal,
                "task_template_created",
                template.id,
                data.name,
                client_ip=client_ip,
                user_agent=user_agent,
                extra={"items": len(items)},
            )
            session.flush()
    except IntegrityError:
        raise TemplateNameTakenError from None
    return TemplateView(template, items)


def update_template(
    session: Session,
    principal: Principal,
    template_id: uuid.UUID,
    data: TaskTemplateCreate,
    *,
    client_ip: str,
    user_agent: str | None,
) -> TemplateView:
    """Cambia el nombre y reemplaza las tareas de la plantilla en una sola transacción.

    Las tareas que ya se crearon desde la plantilla no cambian: son tareas normales del caso.
    """
    organization_id = _require_manager(principal)
    session.commit()
    try:
        with session.begin():
            template = session.scalar(
                select(TaskTemplate)
                .where(
                    TaskTemplate.id == template_id,
                    TaskTemplate.organization_id == organization_id,
                )
                .with_for_update()
            )
            if template is None:
                raise TemplateNotFoundError
            previous_name = template.name
            session.execute(
                delete(TaskTemplateItem).where(TaskTemplateItem.template_id == template_id)
            )
            template.name = data.name
            items = _build_items(organization_id, template_id, data)
            session.add_all(items)
            _audit(
                session,
                principal,
                "task_template_updated",
                template_id,
                data.name,
                client_ip=client_ip,
                user_agent=user_agent,
                extra={"previous_name": previous_name, "items": len(items)},
            )
            session.flush()
    except IntegrityError:
        raise TemplateNameTakenError from None
    return TemplateView(template, items)


def delete_template(
    session: Session,
    principal: Principal,
    template_id: uuid.UUID,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    organization_id = _require_manager(principal)
    session.commit()
    with session.begin():
        template = session.scalar(
            select(TaskTemplate).where(
                TaskTemplate.id == template_id, TaskTemplate.organization_id == organization_id
            )
        )
        if template is None:
            raise TemplateNotFoundError
        _audit(
            session,
            principal,
            "task_template_deleted",
            template_id,
            template.name,
            client_ip=client_ip,
            user_agent=user_agent,
        )
        session.delete(template)


def _due_at(days: int | None, now: datetime.datetime) -> datetime.datetime | None:
    if days is None:
        return None
    day = now.astimezone(_BOGOTA).date() + datetime.timedelta(days=days)
    return datetime.datetime.combine(day, datetime.time(_DUE_HOUR), tzinfo=_BOGOTA).astimezone(
        datetime.UTC
    )


def apply_template(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    template_id: uuid.UUID,
    assigned_to: uuid.UUID,
    *,
    client_ip: str,
    user_agent: str | None,
) -> list[TaskView]:
    """Crea las tareas de la plantilla en un caso abierto, todas o ninguna."""
    _require_manager(principal)
    session.commit()
    with session.begin():
        case = _member_case(session, principal, case_id, lock=True)
        _active_organization(session, case.organization_id)
        if case.status != "open":
            raise ClosedCaseTaskError
        template = session.scalar(
            select(TaskTemplate).where(
                TaskTemplate.id == template_id,
                TaskTemplate.organization_id == case.organization_id,
            )
        )
        if template is None:
            raise TemplateNotFoundError
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
                User.id == assigned_to,
                User.status == "active",
            )
        ).one_or_none()
        if assignee is None:
            raise TaskAssigneeNotFoundError
        now = datetime.datetime.now(datetime.UTC)
        views: list[TaskView] = []
        for item in _items_of(session, [template.id])[template.id]:
            task = CaseTask(
                organization_id=case.organization_id,
                case_id=case.id,
                title=item.title,
                description=item.description,
                priority=item.priority,
                due_at=_due_at(item.due_days, now),
                assigned_to=assigned_to,
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
                        "assigned_to": str(assigned_to),
                        "priority": item.priority,
                        "due_at": task.due_at.isoformat() if task.due_at else None,
                        "template_id": str(template.id),
                    },
                    ip=audit_ip(client_ip),
                    user_agent=audit_user_agent(user_agent),
                )
            )
            views.append(TaskView(task, assignee.full_name))
    return views
