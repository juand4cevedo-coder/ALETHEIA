"""Plantillas de tareas del despacho y su aplicación a un caso."""

import uuid
from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.cases import get_case_worker
from app.api.deps import get_client_ip, get_principal, get_session
from app.api.tasks import _out as task_out
from app.schemas.task_templates import (
    AppliedTaskTemplate,
    ApplyTaskTemplate,
    TaskTemplateCreate,
    TaskTemplateItemOut,
    TaskTemplateList,
    TaskTemplateOut,
)
from app.services import task_templates as template_service
from app.services import tasks as task_service
from app.services.members import OrganizationNotActiveError
from app.services.sessions import Principal

router = APIRouter(tags=["plantillas de tareas"], dependencies=[Depends(get_case_worker)])

_FORBIDDEN = "Este rol no gestiona plantillas de tareas."


def _out(view: template_service.TemplateView) -> TaskTemplateOut:
    return TaskTemplateOut(
        id=view.template.id,
        name=view.template.name,
        created_at=view.template.created_at,
        items=[
            TaskTemplateItemOut(
                title=item.title,
                description=item.description,
                priority=cast(Literal["low", "normal", "high", "urgent"], item.priority),
                due_days=item.due_days,
            )
            for item in view.items
        ],
    )


@router.get("/task-templates", summary="Listar las plantillas de tareas del despacho")
def list_task_templates(
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> TaskTemplateList:
    response.headers["Cache-Control"] = "no-store"
    try:
        views = template_service.list_templates(session, principal)
    except task_service.TaskNotAllowedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    return TaskTemplateList(items=[_out(view) for view in views])


@router.post(
    "/task-templates",
    status_code=status.HTTP_201_CREATED,
    summary="Crear una plantilla de tareas",
)
def create_task_template(
    data: TaskTemplateCreate,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> TaskTemplateOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        view = template_service.create_template(
            session, principal, data, client_ip=client_ip, user_agent=user_agent
        )
    except task_service.TaskNotAllowedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    except template_service.TemplateNameTakenError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Ya tiene una plantilla con ese nombre.",
        ) from None
    return _out(view)


@router.put(
    "/task-templates/{template_id}",
    summary="Editar una plantilla de tareas: cambia el nombre y reemplaza sus tareas",
)
def update_task_template(
    template_id: uuid.UUID,
    data: TaskTemplateCreate,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> TaskTemplateOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        view = template_service.update_template(
            session, principal, template_id, data, client_ip=client_ip, user_agent=user_agent
        )
    except task_service.TaskNotAllowedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    except template_service.TemplateNotFoundError:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="No encontramos esa plantilla."
        ) from None
    except template_service.TemplateNameTakenError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Ya tiene una plantilla con ese nombre.",
        ) from None
    return _out(view)


@router.delete(
    "/task-templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Borrar una plantilla de tareas",
)
def delete_task_template(
    template_id: uuid.UUID,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> Response:
    try:
        template_service.delete_template(
            session, principal, template_id, client_ip=client_ip, user_agent=user_agent
        )
    except task_service.TaskNotAllowedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    except template_service.TemplateNotFoundError:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="No encontramos esa plantilla."
        ) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers={"Cache-Control": "no-store"})


@router.post(
    "/cases/{case_id}/tasks/from-template",
    status_code=status.HTTP_201_CREATED,
    summary="Crear en un caso las tareas de una plantilla",
)
def apply_task_template(
    case_id: uuid.UUID,
    data: ApplyTaskTemplate,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> AppliedTaskTemplate:
    response.headers["Cache-Control"] = "no-store"
    try:
        views = template_service.apply_template(
            session,
            principal,
            case_id,
            data.template_id,
            data.assigned_to,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except task_service.TaskNotAllowedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN) from None
    except (
        task_service.TaskCaseNotFoundError,
        task_service.TaskAssigneeNotFoundError,
        template_service.TemplateNotFoundError,
    ):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="El caso, la plantilla o la persona asignada no están disponibles.",
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
    return AppliedTaskTemplate(tasks=[task_out(view) for view in views])
