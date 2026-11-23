"""Eliminar un caso cerrado de forma definitiva (SEQ-004, CU-007, RN-006).

Es una operación sin vuelta atrás y por eso tiene dos tiempos:

1. La solicitud la hace un dueño o un administrador, escribiendo el título del caso. Solo se
   acepta si el caso está cerrado, sin bloqueo jurídico y con el plazo de conservación vencido.
   En ese instante el caso pasa a «deleting» y su llave envuelta se destruye: el contenido
   cifrado deja de ser recuperable aunque algo falle después.
2. La tarea `case_purge` borra los objetos cifrados del almacenamiento y llama a `purge_case`,
   la única vía que borra la cadena de custodia. Esa función deja primero la constancia
   permanente (cuántas evidencias, cuántos bytes y sus huellas, sin nombres) y después elimina
   el expediente. Los respaldos conservan una copia cifrada por 7 días más.

La tarea se puede repetir: borrar un objeto que ya no existe no falla y `purge_case` devuelve la
misma constancia si el caso ya no está. Si un objeto no se puede borrar, la tarea falla y se
reintenta; no se elimina el expediente con restos sueltos.
"""

import datetime
import logging
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Final

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.adapters.evidence_storage import delete_evidence_object
from app.adapters.export_storage import delete_export
from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import (
    AuditLog,
    Case,
    ClientPortalDocument,
    DeletionRecord,
    Evidence,
    Export,
    Membership,
    Organization,
    User,
)
from app.services import jobs
from app.services.audit import audit_ip, audit_user_agent
from app.services.cases import CaseNotFoundError as _CaseNotFound
from app.services.cases import NotAllowedToManageCaseError, _manage_case
from app.services.jobs import PermanentJobError
from app.services.sessions import Principal
from app.services.tasks import (
    TaskCaseNotFoundError,
    TaskNotAllowedError,
    _active_organization,
)

logger = logging.getLogger(__name__)

CaseNotFoundError = TaskCaseNotFoundError
DeletionNotAllowedError = TaskNotAllowedError
RECEIPT_TEMPLATE: Final = "case_deletion_receipt"
BACKUP_RETENTION_DAYS: Final = 7


class ConfirmationMismatchError(Exception):
    """El texto escrito no coincide con el título del caso."""


class NotClosedError(Exception):
    """Solo se elimina un caso cerrado."""


class LegalHoldError(Exception):
    """El caso tiene un bloqueo jurídico vigente."""


class RetentionPendingError(Exception):
    """El plazo de conservación del caso todavía no terminó."""

    def __init__(self, until: datetime.datetime) -> None:
        super().__init__(until.isoformat())
        self.until = until


@dataclass(frozen=True, slots=True)
class Requested:
    case_id: uuid.UUID


def request(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    confirmation: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> Requested:
    """Pide eliminar el caso: lo marca, destruye su llave y encola el borrado."""
    # Los permisos de conservación son los de dueños y administradores, justo quienes pueden
    # eliminar.
    session.commit()
    with session.begin():
        try:
            case = _manage_case(session, principal, case_id, "cases.manage_retention")
        except _CaseNotFound:
            raise CaseNotFoundError from None
        except NotAllowedToManageCaseError:
            raise DeletionNotAllowedError from None
        _active_organization(session, case.organization_id)
        if case.status == "deleting":
            return Requested(case.id)  # repetir la solicitud no cambia nada
        if confirmation.strip() != case.title:
            raise ConfirmationMismatchError
        if case.status != "closed":
            raise NotClosedError
        if case.legal_hold:
            raise LegalHoldError
        now = datetime.datetime.now(datetime.UTC)
        if case.retention_until is None or case.retention_until > now:
            raise RetentionPendingError(case.retention_until or now)
        organization_id = case.organization_id
        session.scalar(
            select(func.request_case_deletion(case.id, organization_id, principal.user_id))
        )
        session.add(
            AuditLog(
                organization_id=organization_id,
                actor_user_id=principal.user_id,
                action="case_deletion_requested",
                target_id=case.id,
                details={"case_id": str(case.id)},
                ip=audit_ip(client_ip),
                user_agent=audit_user_agent(user_agent),
            )
        )
        jobs.enqueue(
            session,
            "case_purge",
            {
                "case_id": str(case.id),
                "organization_id": str(organization_id),
                "requested_by": str(principal.user_id),
            },
            f"case_purge:{case.id}",
        )
        session.flush()
    return Requested(case_id)


def _object_keys(session: Session, case_id: uuid.UUID) -> list[str]:
    evidence = session.scalars(select(Evidence.storage_key).where(Evidence.case_id == case_id))
    exports = session.scalars(
        select(Export.storage_key).where(Export.case_id == case_id, Export.storage_key.is_not(None))
    )
    documents = session.scalars(
        select(ClientPortalDocument.storage_key).where(ClientPortalDocument.case_id == case_id)
    )
    return [*evidence, *(key for key in exports if key is not None), *documents]


def _purge_actor(
    session: Session, organization_id: uuid.UUID, requested_by: uuid.UUID
) -> uuid.UUID:
    """Quien firma el borrado: quien lo pidió, si sigue siendo dueño o administrador, o si no un
    dueño del despacho."""
    allowed = session.scalar(
        select(Membership.user_id).where(
            Membership.organization_id == organization_id,
            Membership.user_id == requested_by,
            Membership.role.in_(("owner", "admin")),
        )
    )
    if allowed is not None:
        return allowed
    owner = session.scalar(
        select(Membership.user_id)
        .where(Membership.organization_id == organization_id, Membership.role == "owner")
        .order_by(Membership.user_id)
    )
    if owner is None:
        msg = "El despacho no tiene un dueño que firme la eliminación."
        raise PermanentJobError(msg)
    return owner


def purge(
    open_session: Callable[[], Session],
    settings: Settings,
    case_id: uuid.UUID,
    organization_id: uuid.UUID,
    requested_by: uuid.UUID,
) -> None:
    """Borra los objetos y después el expediente. Se puede repetir sin cambiar el resultado."""
    with open_session() as session, session.begin():
        set_tenant(session, TenantContext(organization_id=organization_id))
        status = session.scalar(select(Case.status).where(Case.id == case_id))
        if status is None:
            return  # ya se eliminó; la constancia y el aviso se hicieron en ese intento
        if status != "deleting":
            msg = "El caso no está marcado para eliminar."
            raise PermanentJobError(msg)
        keys = _object_keys(session, case_id)

    failed = 0
    for key in keys:
        try:
            if key.startswith("exports/"):
                delete_export(settings, key)
            else:
                delete_evidence_object(settings, key)
        except Exception:
            failed += 1
            logger.exception("No se pudo borrar un objeto cifrado del caso %s", case_id)
    if failed:
        msg = f"No se pudieron borrar {failed} objeto(s) cifrado(s); se reintenta."
        raise RuntimeError(msg)

    with open_session() as session, session.begin():
        # purge_case exige que quien la pide sea, en la sesión, dueño o administrador. Si quien
        # pidió la eliminación ya no lo es, la termina un dueño del despacho: la llave ya se
        # destruyó y el borrado no puede quedar a medias por un cambio de roles.
        set_tenant(session, TenantContext(organization_id=organization_id))
        actor = _purge_actor(session, organization_id, requested_by)
        set_tenant(session, TenantContext(organization_id=organization_id, user_id=actor))
        record_id = uuid.uuid7()
        result = session.scalar(
            text(
                "SELECT purge_case(:case_id, :record_id, :requested_by, "
                "make_interval(days => :days))"
            ).bindparams(
                case_id=case_id,
                record_id=record_id,
                requested_by=actor,
                days=BACKUP_RETENTION_DAYS,
            )
        )
        if result is None:
            msg = "purge_case no devolvió una constancia."
            raise RuntimeError(msg)
        if result == record_id:  # primera vez: un reintento no repite la auditoría
            session.add(
                AuditLog(
                    organization_id=organization_id,
                    actor_user_id=actor,
                    action="case_deleted",
                    target_id=case_id,
                    details={"record_id": str(record_id)},
                )
            )
        jobs.enqueue(
            session,
            "email_send",
            {
                "template": RECEIPT_TEMPLATE,
                "record_id": str(result),
                "organization_id": str(organization_id),
                "user_id": str(requested_by),
            },
            f"{RECEIPT_TEMPLATE}:{case_id}",
        )


def receipt_facts(session: Session, payload: dict[str, Any]) -> tuple[DeletionRecord, User, str]:
    """La constancia, quien pidió la eliminación y el nombre del despacho, para el correo."""
    try:
        record_id = uuid.UUID(str(payload["record_id"]))
        organization_id = uuid.UUID(str(payload["organization_id"]))
        user_id = uuid.UUID(str(payload["user_id"]))
    except KeyError, ValueError:
        msg = "La tarea de correo de la constancia no trae identificadores válidos."
        raise PermanentJobError(msg) from None
    set_tenant(session, TenantContext(organization_id=organization_id))
    record = session.get(DeletionRecord, record_id)
    user = session.get(User, user_id)
    organization = session.get(Organization, organization_id)
    if record is None or user is None or organization is None:
        msg = "La constancia de eliminación no se encontró."
        raise PermanentJobError(msg)
    return record, user, organization.name
