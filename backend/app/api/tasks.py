"""Tareas y plazos de los casos."""

import uuid
from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.cases import get_case_worker
from app.api.deps import get_client_ip, get_principal, get_session
from app.schemas.tasks import CaseTaskCreate, CaseTaskOut, CaseTaskPage, CaseTaskStatusUpdate
from app.services import tasks as task_service
from app.services.members import OrganizationNotActiveError
from app.services.sessions import Principal

router = APIRouter(
    prefix="/cases",
    tags=["tareas"],
    dependencies=[Depends(get_case_worker)],
)


def _out(view: task_service.TaskView) -> CaseTaskOut:
    task = view.task
    return CaseTaskOut(
        id=task.id,
        case_id=task.case_id,
        title=task.title,
        description=task.description,
        priority=cast(Literal["low", "normal", "high", "urgent"], task.priority),
        status=cast(Literal["pending", "in_progress", "completed", "canceled"], task.status),
        due_at=task.due_at,
        assigned_to=task.assigned_to,
        assignee_name=view.assignee_name,
        created_by=task.created_by,
        created_at=task.created_at,
        updated_at=task.updated_at,
        completed_at=task.completed_at,
    )


@router.get("/{case_id}/tasks", summary="Listar tareas y plazos de un caso")
def list_case_tasks(
    case_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    cursor: uuid.UUID | None = None,
    task_status: Annotated[
        Literal["pending", "in_progress", "completed", "canceled"] | None,
        Query(alias="status"),
    ] = None,
    assigned_to: uuid.UUID | None = None,
    search: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 25,
) -> CaseTaskPage:
    response.headers["Cache-Control"] = "no-store"
    try:
        items, next_cursor = task_service.list_tasks(
            session,
            principal,
            case_id,
            cursor=cursor,
            status=task_status,
            assigned_to=assigned_to,
            search=search,
            limit=limit,
        )
    except task_service.TaskCaseNotFoundError:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="No encontramos lo que busca o no tiene acceso a ello.",
        ) from None
    return CaseTaskPage(items=[_out(item) for item in items], next_cursor=next_cursor)


@router.post(
    "/{case_id}/tasks",
    status_code=status.HTTP_201_CREATED,
    summary="Crear y asignar una tarea del caso",
)
def create_case_task(
    case_id: uuid.UUID,
    data: CaseTaskCreate,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> CaseTaskOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        view = task_service.create_task(
            session,
            principal,
            case_id,
            data,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except task_service.TaskCaseNotFoundError, task_service.TaskAssigneeNotFoundError:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="El caso o la persona asignada no están disponibles.",
        ) from None
    except task_service.TaskNotAllowedError:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Este rol no crea ni asigna tareas.",
        ) from None
    except task_service.ClosedCaseTaskError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Un caso archivado no admite nuevas tareas.",
        ) from None
    except OrganizationNotActiveError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="El despacho está en modo de consulta y no admite cambios.",
        ) from None
    response.headers["Location"] = f"/api/v1/cases/{case_id}/tasks/{view.task.id}"
    return _out(view)


@router.patch(
    "/{case_id}/tasks/{task_id}/status",
    summary="Actualizar el estado de una tarea del caso",
)
def update_case_task_status(
    case_id: uuid.UUID,
    task_id: uuid.UUID,
    data: CaseTaskStatusUpdate,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> CaseTaskOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        return _out(
            task_service.update_task_status(
                session,
                principal,
                case_id,
                task_id,
                data.status,
                client_ip=client_ip,
                user_agent=user_agent,
            )
        )
    except task_service.TaskCaseNotFoundError, task_service.TaskNotFoundError:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="No encontramos la tarea o no tiene acceso a ella.",
        ) from None
    except task_service.TaskNotAllowedError:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Solo puede actualizar tareas asignadas a usted.",
        ) from None
    except task_service.ClosedCaseTaskError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Las tareas de un caso archivado son de solo consulta.",
        ) from None
    except OrganizationNotActiveError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="El despacho está en modo de consulta y no admite cambios.",
        ) from None
