"""Consulta de eventos de seguridad del despacho (HU-014)."""

import csv
import datetime
import io
import uuid
from collections.abc import Sequence
from typing import Final

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog
from app.services.members import organization_of_manager
from app.services.sessions import Principal

# Los eventos operativos de casos y soporte no pertenecen a la auditoría de seguridad del
# despacho. La lista explícita impide que un tipo nuevo exponga datos por accidente.
SECURITY_ACTIONS = (
    "user_registered",
    "email_verified",
    "login",
    "login_failed",
    "google_linked",
    "session_reuse_detected",
    "sessions_revoked",
    "password_reset",
    "password_changed",
    "invitation_sent",
    "invitation_revoked",
    "invitation_accepted",
    "role_changed",
    "ownership_transferred",
    "archive_exported",
    "member_removed",
    "organization_policy_changed",
    "task_template_created",
    "task_template_updated",
    "task_template_deleted",
    "two_factor_enabled",
    "two_factor_disabled",
    "two_factor_failed",
    "two_factor_recovery_used",
    "two_factor_codes_regenerated",
    "plan_changed",
    "subscription_canceled",
    "subscription_expired",
    "courtesy_granted",
    "courtesy_renewed",
    "courtesy_revoked",
    "account_blocked",
    "account_unblocked",
    "account_closed",
    "legal_accepted",
    "logout",
)


def events(
    session: Session,
    principal: Principal,
    *,
    after: uuid.UUID | None,
    limit: int,
    action: str | None = None,
    actor: uuid.UUID | None = None,
    created_from: datetime.datetime | None = None,
    created_to: datetime.datetime | None = None,
) -> list[AuditLog]:
    """Pagina eventos de la organización del gestor; RLS refuerza el mismo límite."""
    organization_id = organization_of_manager(principal)
    query = (
        select(AuditLog)
        .where(
            AuditLog.organization_id == organization_id,
            AuditLog.action.in_(SECURITY_ACTIONS),
        )
        .order_by(AuditLog.id.desc())
        .limit(limit)
    )
    if after is not None:
        query = query.where(AuditLog.id < after)
    if action is not None:
        query = query.where(AuditLog.action == action)
    if actor is not None:
        query = query.where(AuditLog.actor_user_id == actor)
    if created_from is not None:
        query = query.where(AuditLog.created_at >= created_from)
    if created_to is not None:
        query = query.where(AuditLog.created_at < created_to)
    return list(session.scalars(query))


# Tope de filas de una exportación: un despacho con años de eventos no debe poder pedir toda la
# tabla en una sola respuesta. Si hay más, la exportación trae las más recientes y lo avisa.
MAX_EXPORT_ROWS: Final = 5000

CSV_COLUMNS: Final = ("fecha_utc", "accion", "persona_id", "objeto_id", "ip", "navegador")

# Una hoja de cálculo ejecuta como fórmula lo que empieza con estos caracteres. El navegador
# lo escribe quien inicia sesión, así que se neutraliza antes de entregarlo.
_FORMULA_PREFIXES: Final = ("=", "+", "-", "@", "\t", "\r")


def _safe_cell(value: str | None) -> str:
    if value is None:
        return ""
    return "'" + value if value.startswith(_FORMULA_PREFIXES) else value


def to_csv(rows: Sequence[AuditLog]) -> str:
    """Los eventos como CSV, sin los detalles internos: las mismas columnas que ve la lista."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(CSV_COLUMNS)
    for event in rows:
        writer.writerow(
            (
                event.created_at.astimezone(datetime.UTC).isoformat(timespec="seconds"),
                event.action,
                str(event.actor_user_id) if event.actor_user_id is not None else "",
                str(event.target_id) if event.target_id is not None else "",
                str(event.ip) if event.ip is not None else "",
                _safe_cell(event.user_agent),
            )
        )
    return buffer.getvalue()
