"""Operaciones de plataforma, separadas de los datos de cada despacho."""

import datetime
import uuid
from contextlib import suppress
from typing import Annotated, Literal, cast
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.api.deps import get_app_settings, get_client_ip, get_principal, get_session
from app.core.config import Settings
from app.models import AuditLog, Organization, PaymentEvent, Plan, Subscription, User
from app.repositories.sessions import revoke_user_sessions
from app.schemas.platform import (
    AccountDeletionRequest,
    CourtesyGrant,
    CourtesyRevoke,
    CourtesyTarget,
    PlatformAuditEvent,
    PlatformAuditPage,
    PlatformBilling,
    PlatformPlan,
    PlatformUser,
    PlatformUserPage,
    UserStatusChange,
)
from app.schemas.web_vitals import VitalsSummary, VitalSummaryRow
from app.services import courtesy
from app.services import platform_accounts as accounts_service
from app.services import receipts as receipts_service
from app.services import web_vitals as vitals_service
from app.services.audit import audit_ip
from app.services.sessions import Principal

router = APIRouter(prefix="/platform", tags=["plataforma"])


def get_platform_admin(
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> Principal:
    """Comprueba el atributo en la base en cada petición; no confía en la interfaz ni el token."""
    is_admin = session.scalar(select(User.is_platform_admin).where(User.id == principal.user_id))
    if is_admin is not True:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta no administra la plataforma.",
            headers={"Cache-Control": "no-store"},
        )
    return principal


def _courtesy_result(response: Response, view: courtesy.CourtesyView) -> CourtesyTarget:
    response.headers["Cache-Control"] = "no-store"
    return CourtesyTarget.model_validate(view, from_attributes=True)


@router.get("/courtesy", summary="Buscar un despacho por cualquiera de sus cuentas")
def lookup_courtesy(
    response: Response,
    principal: Annotated[Principal, Depends(get_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
    account_email: str,
) -> CourtesyTarget:
    try:
        return _courtesy_result(
            response, courtesy.lookup(session, principal.user_id, account_email)
        )
    except courtesy.AccountNotFound:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="No encontramos un despacho asociado a esa cuenta."
        ) from None


@router.post("/courtesy", summary="Asignar o renovar el plan de un despacho")
def grant_courtesy(
    change: CourtesyGrant,
    response: Response,
    principal: Annotated[Principal, Depends(get_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> CourtesyTarget:
    try:
        view = courtesy.grant(
            session,
            principal.user_id,
            change.organization_id,
            change.account_email,
            change.plan_code,
            change.reason.strip(),
            change.ends_at,
            client_ip,
        )
        return _courtesy_result(response, view)
    except courtesy.AccountNotFound:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="No encontramos un despacho asociado a esa cuenta."
        ) from None
    except courtesy.CourtesyConflict:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="No se puede asignar este plan."
        ) from None
    except PermissionError:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Esta cuenta no administra la plataforma."
        ) from None


@router.post("/courtesy/revoke", summary="Revocar el acceso comercial de un despacho")
def revoke_courtesy(
    change: CourtesyRevoke,
    response: Response,
    principal: Annotated[Principal, Depends(get_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> CourtesyTarget:
    try:
        view = courtesy.revoke(
            session,
            principal.user_id,
            change.organization_id,
            change.account_email,
            change.reason.strip(),
            client_ip,
        )
        return _courtesy_result(response, view)
    except courtesy.AccountNotFound:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="No encontramos un despacho asociado a esa cuenta."
        ) from None
    except courtesy.CourtesyConflict:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="No hay un acceso asignado por la plataforma."
        ) from None
    except PermissionError:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Esta cuenta no administra la plataforma."
        ) from None


def _public_user(user: User) -> PlatformUser:
    return PlatformUser(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        status=cast(Literal["active", "blocked"], user.status),
        email_verified=user.email_verified_at is not None,
        platform_admin=user.is_platform_admin,
        created_at=user.created_at,
    )


@router.get("/users", summary="Cuentas de la plataforma")
def list_platform_users(
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
            description="Nombre o correo de la cuenta.",
        ),
    ] = None,
    user_status: Annotated[
        Literal["active", "blocked"] | None,
        Query(alias="status", description="Estado actual de la cuenta."),
    ] = None,
    email_verified: Annotated[
        bool | None, Query(description="Si la cuenta confirmó su correo.")
    ] = None,
    platform_admin: Annotated[
        bool | None, Query(description="Si la cuenta administra la plataforma.")
    ] = None,
) -> PlatformUserPage:
    del principal
    response.headers["Cache-Control"] = "no-store"
    # Las cuentas eliminadas ya no existen para la plataforma: solo queda su seudónimo.
    filters: list[ColumnElement[bool]] = [User.status != "closed"]
    if search is not None:
        term = search.strip().lower()
        filters.append(
            or_(
                func.lower(User.full_name).contains(term, autoescape=True),
                func.lower(User.email).contains(term, autoescape=True),
            )
        )
    if user_status is not None:
        filters.append(User.status == user_status)
    if email_verified is not None:
        filters.append(
            User.email_verified_at.is_not(None)
            if email_verified
            else User.email_verified_at.is_(None)
        )
    if platform_admin is not None:
        filters.append(User.is_platform_admin.is_(platform_admin))

    total = session.scalar(select(func.count()).select_from(User).where(*filters)) or 0
    query = select(User).where(*filters).order_by(User.id.desc()).limit(51)
    if cursor is not None:
        query = query.where(User.id < cursor)
    users = list(session.scalars(query))
    return PlatformUserPage(
        items=[_public_user(user) for user in users[:50]],
        next_cursor=users[49].id if len(users) > 50 else None,
        total=total,
    )


@router.patch("/users/{user_id}/status", summary="Bloquear o desbloquear una cuenta")
def change_platform_user_status(
    user_id: uuid.UUID,
    change: UserStatusChange,
    response: Response,
    principal: Annotated[Principal, Depends(get_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> PlatformUser:
    response.headers["Cache-Control"] = "no-store"
    user = session.scalar(select(User).where(User.id == user_id).with_for_update())
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="La cuenta no existe.")
    if user.id == principal.user_id or user.is_platform_admin:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="La cuenta administradora de plataforma no se bloquea desde esta operación.",
        )
    if user.status != change.status:
        user.status = change.status
        now = datetime.datetime.now(datetime.UTC)
        if change.status == "blocked":
            revoke_user_sessions(session, user.id, now)
        session.add(
            AuditLog(
                organization_id=None,
                actor_user_id=principal.user_id,
                action="account_blocked" if change.status == "blocked" else "account_unblocked",
                target_id=user.id,
                ip=audit_ip(client_ip),
                user_agent=None,
                created_at=now,
            )
        )
        session.commit()
    return _public_user(user)


@router.post(
    "/users/{user_id}/deletion",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar definitivamente una cuenta, por ejemplo una de prueba",
    responses={
        404: {"description": "La cuenta no existe o ya está eliminada."},
        409: {
            "description": (
                "Es una cuenta de plataforma, o es la responsable de un despacho con más personas."
            )
        },
        422: {"description": "El correo escrito no coincide con el de la cuenta."},
    },
)
def delete_platform_user(
    user_id: uuid.UUID,
    data: AccountDeletionRequest,
    principal: Annotated[Principal, Depends(get_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> Response:
    """Cierra sus sesiones, libera su correo y minimiza su identidad. Los casos con conservación
    vigente se conservan; si es la única responsable de su despacho, el despacho se cierra."""
    try:
        accounts_service.delete_account(
            session,
            principal,
            user_id,
            data.confirmation,
            client_ip=client_ip,
            user_agent=None,
        )
    except accounts_service.AccountNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="La cuenta no existe.") from None
    except accounts_service.ProtectedAccountError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Una cuenta de plataforma no se elimina desde esta operación.",
        ) from None
    except accounts_service.ConfirmationMismatchError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="El correo escrito no coincide con el de la cuenta.",
        ) from None
    except accounts_service.OwnerHasTeamError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Es la responsable de un despacho con más personas. Retire primero a las demás."
            ),
        ) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers={"Cache-Control": "no-store"})


@router.get("/billing", summary="Resumen comercial de la plataforma")
def platform_billing(
    response: Response,
    principal: Annotated[Principal, Depends(get_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> PlatformBilling:
    del principal
    response.headers["Cache-Control"] = "no-store"
    plans = list(session.scalars(select(Plan).order_by(Plan.name)))
    counts = session.execute(
        select(Subscription.status, func.count()).group_by(Subscription.status)
    ).all()
    received = session.scalar(select(func.count()).select_from(PaymentEvent)) or 0
    pending = (
        session.scalar(
            select(func.count())
            .select_from(PaymentEvent)
            .where(PaymentEvent.processed_at.is_(None))
        )
        or 0
    )
    year = datetime.datetime.now(ZoneInfo("America/Bogota")).year
    collected = receipts_service.collected_in(session, year)
    return PlatformBilling(
        collected_year=collected.year,
        receipts_year=collected.receipts,
        collected_year_cop=collected.collected_cop,
        invoicing_threshold_uvt=settings.invoicing_threshold_uvt,
        uvt_value_cop=settings.uvt_value_cop,
        invoicing_threshold_cop=settings.invoicing_threshold_uvt * settings.uvt_value_cop,
        plans=[
            PlatformPlan(
                code=plan.code,
                name=plan.name,
                monthly_price_cop=plan.monthly_price_cop,
                annual_price_cop=plan.annual_price_cop,
                included_users=plan.included_users,
                is_public=plan.is_public,
            )
            for plan in plans
        ],
        subscription_counts={status: count for status, count in counts},
        payment_events_received=received,
        payment_events_pending=pending,
    )


@router.get("/audit", summary="Auditoría transversal de la plataforma")
def platform_audit(
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
            description="Nombre o correo del actor, organización o UUID del objeto.",
        ),
    ] = None,
    action: Annotated[str | None, Query(min_length=1, max_length=64, pattern=r"^[a-z_]+$")] = None,
    created_from: Annotated[
        datetime.datetime | None,
        Query(description="Inicio inclusivo del periodo, con zona horaria."),
    ] = None,
    created_to: Annotated[
        datetime.datetime | None,
        Query(description="Fin exclusivo del periodo, con zona horaria."),
    ] = None,
) -> PlatformAuditPage:
    del principal
    response.headers["Cache-Control"] = "no-store"
    for boundary in (created_from, created_to):
        if boundary is not None and boundary.tzinfo is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Las fechas de auditoría deben incluir zona horaria.",
            )
    if created_from is not None and created_to is not None and created_from >= created_to:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="El inicio del periodo debe ser anterior al final.",
        )

    filters: list[ColumnElement[bool]] = []
    if search is not None:
        term = search.strip().lower()
        matching_actor_ids = select(User.id).where(
            or_(
                func.lower(User.full_name).contains(term, autoescape=True),
                func.lower(User.email).contains(term, autoescape=True),
            )
        )
        matching_organization_ids = select(Organization.id).where(
            func.lower(Organization.name).contains(term, autoescape=True)
        )
        matches: list[ColumnElement[bool]] = [
            AuditLog.actor_user_id.in_(matching_actor_ids),
            AuditLog.organization_id.in_(matching_organization_ids),
        ]
        with suppress(ValueError):
            matches.append(AuditLog.target_id == uuid.UUID(term))
        filters.append(or_(*matches))
    if action is not None:
        filters.append(AuditLog.action == action)
    if created_from is not None:
        filters.append(AuditLog.created_at >= created_from)
    if created_to is not None:
        filters.append(AuditLog.created_at < created_to)

    total = session.scalar(select(func.count()).select_from(AuditLog).where(*filters)) or 0
    query = select(AuditLog).where(*filters).order_by(AuditLog.id.desc()).limit(51)
    if cursor is not None:
        query = query.where(AuditLog.id < cursor)
    events = list(session.scalars(query))
    page = events[:50]

    # Una sola consulta por tabla para toda la página, en vez de una por fila.
    page_actor_ids = {event.actor_user_id for event in page if event.actor_user_id is not None}
    page_organization_ids = {
        event.organization_id for event in page if event.organization_id is not None
    }
    actor_names = dict(
        session.execute(select(User.id, User.full_name).where(User.id.in_(page_actor_ids))).all()
    )
    organization_names = dict(
        session.execute(
            select(Organization.id, Organization.name).where(
                Organization.id.in_(page_organization_ids)
            )
        ).all()
    )
    return PlatformAuditPage(
        items=[
            PlatformAuditEvent(
                id=event.id,
                action=event.action,
                actor_user_id=event.actor_user_id,
                actor_name=actor_names.get(event.actor_user_id) if event.actor_user_id else None,
                organization_id=event.organization_id,
                organization_name=(
                    organization_names.get(event.organization_id) if event.organization_id else None
                ),
                target_id=event.target_id,
                created_at=event.created_at,
            )
            for event in page
        ],
        next_cursor=events[49].id if len(events) > 50 else None,
        total=total,
    )


@router.get(
    "/web-vitals",
    summary="Rendimiento real: percentil 75 por versión, dispositivo y métrica",
)
def platform_web_vitals(
    response: Response,
    principal: Annotated[Principal, Depends(get_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
    days: Annotated[int, Query(ge=1, le=90, description="Días hacia atrás que entran.")] = 14,
) -> VitalsSummary:
    del principal
    response.headers["Cache-Control"] = "no-store"
    total, rows = vitals_service.summary(session, days)
    return VitalsSummary(
        days=days,
        total_samples=total,
        rows=[VitalSummaryRow.model_validate(row, from_attributes=True) for row in rows],
    )
