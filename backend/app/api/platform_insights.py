"""Resumen, directorio de despachos y operación para la cuenta propietaria de la plataforma."""

import datetime
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_session
from app.api.platform import get_platform_admin
from app.models import AuditLog, Job
from app.schemas.platform_insights import (
    PlatformOperations,
    PlatformOrganizationPage,
    PlatformOverview,
    PlatformSignupDay,
)
from app.services import platform_insights as insights
from app.services.audit import audit_ip
from app.services.sessions import Principal

router = APIRouter(prefix="/platform", tags=["plataforma"])


@router.get("/overview", summary="Resumen de la plataforma")
def platform_overview(
    response: Response,
    principal: Annotated[Principal, Depends(get_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> PlatformOverview:
    del principal
    response.headers["Cache-Control"] = "no-store"
    summary = insights.overview(session)
    return PlatformOverview.model_validate(
        {
            **{field: getattr(summary, field) for field in summary.__dataclass_fields__},
            "signups": [
                PlatformSignupDay(day=day, accounts=accounts)
                for day, accounts in insights.signups_by_day(session)
            ],
        }
    )


@router.get("/organizations", summary="Directorio de despachos")
def platform_organizations(
    response: Response,
    principal: Annotated[Principal, Depends(get_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
    cursor: uuid.UUID | None = None,
    search: Annotated[
        str | None,
        Query(
            min_length=1,
            max_length=120,
            pattern=r".*\S.*",
            description="Nombre del despacho, o nombre o correo de su responsable.",
        ),
    ] = None,
    subscription_status: Annotated[
        Literal["trial", "active", "past_due", "canceled", "expired"] | None,
        Query(description="Estado de la suscripción."),
    ] = None,
) -> PlatformOrganizationPage:
    del principal
    response.headers["Cache-Control"] = "no-store"
    page = insights.organizations(
        session, search=search, subscription_status=subscription_status, cursor=cursor
    )
    return PlatformOrganizationPage.model_validate(page)


@router.get("/operations", summary="Cola de tareas y pagos por procesar")
def platform_operations(
    response: Response,
    principal: Annotated[Principal, Depends(get_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> PlatformOperations:
    del principal
    response.headers["Cache-Control"] = "no-store"
    return PlatformOperations.model_validate(insights.operations(session))


@router.post(
    "/jobs/{job_id}/retry",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Devolver a la cola una tarea fallida",
    responses={
        404: {"description": "La tarea no existe."},
        409: {"description": "La tarea no está fallida."},
    },
)
def retry_platform_job(
    job_id: uuid.UUID,
    principal: Annotated[Principal, Depends(get_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> Response:
    """La tarea vuelve con sus intentos en cero y corre en la próxima vuelta del trabajador."""
    job = session.scalar(select(Job).where(Job.id == job_id).with_for_update())
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="La tarea no existe.")
    if job.status != "dead":
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="Solo se reintenta una tarea que falló."
        )
    job.status = "queued"
    job.attempts = 0
    job.last_error = None
    job.run_after = datetime.datetime.now(datetime.UTC)
    session.add(
        AuditLog(
            organization_id=None,
            actor_user_id=principal.user_id,
            action="platform_job_retried",
            target_id=job.id,
            details={"kind": job.kind},
            ip=audit_ip(client_ip),
            user_agent=None,
        )
    )
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers={"Cache-Control": "no-store"})
