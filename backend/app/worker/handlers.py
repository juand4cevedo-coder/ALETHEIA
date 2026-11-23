"""Qué hace el trabajador con cada tipo de tarea de jobs.

Ningún manejador deja una transacción abierta mientras habla con un servicio externo: lee y
escribe la base en transacciones cortas que abre con run.open_session y hace la llamada de red
después de confirmarlas (ADR-038). La cola entrega cada tarea al menos una vez, así que cada
manejador define cómo se comporta si se repite; la tabla está en ADR-038.
"""

import uuid
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any, Final

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.adapters import wompi
from app.adapters.email import EmailDeliveryError, EmailSender
from app.adapters.keys import build_key_wrapper
from app.core.config import Settings

# Registran las plantillas de correo: sin estos imports, el trabajador no las conoce.
from app.services import account_emails as _account_emails  # noqa: F401
from app.services import (
    case_deletion,
    custody_anchor,
    evidence_stamp,
    export_build,
    export_expiration,
    notifications,
    payments,
    subscription_expiration,
)
from app.services import case_deletion_emails as _case_deletion_emails  # noqa: F401
from app.services import client_portal_emails as _client_portal_emails  # noqa: F401
from app.services import organization_emails as _organization_emails  # noqa: F401
from app.services import payment_emails as _payment_emails  # noqa: F401
from app.services import two_factor_recovery_emails as _two_factor_recovery_emails  # noqa: F401
from app.services.jobs import PermanentJobError


@dataclass(frozen=True, slots=True)
class WorkerContext:
    """Lo que usan los manejadores: el envío de correo y la configuración, con la clave de firma y
    la dirección pública para los enlaces."""

    email: EmailSender
    settings: Settings


@dataclass(frozen=True, slots=True)
class JobRun:
    """Una ejecución de una tarea, con lo que su manejador necesita."""

    payload: dict[str, Any]
    context: WorkerContext
    # Abre una sesión nueva; el manejador decide cuándo empieza y termina cada transacción.
    open_session: Callable[[], Session]
    # Extiende la reserva de la tarea. Una tarea larga la llama entre pasos para que otro
    # trabajador no la retome; lanza LeaseLostError si la reserva ya no es de este intento.
    renew_lease: Callable[[], None]


type Handler = Callable[[JobRun], None]


def send_email(run: JobRun) -> None:
    """email_send (EVT-003): arma el correo con los datos de hoy y lo entrega.

    Primero arma el correo en una transacción corta y la confirma: lo que la plantilla guarda,
    como el hash del token de una invitación, queda firme antes de que el enlace salga. Después
    envía, sin ninguna transacción abierta. Si el proceso se cae entre el envío y el cierre de
    la tarea, el reintento manda el correo otra vez: la entrega es al menos una vez (ADR-038).
    """
    with run.open_session() as session, session.begin():
        email = notifications.build_email(session, run.payload, run.context.settings)
    if email is None:
        return
    try:
        run.context.email.send(email)
    except EmailDeliveryError as exc:
        if exc.permanent:
            raise PermanentJobError(str(exc)) from None
        raise


def expire_subscription(run: JobRun) -> None:
    """La fecha y el estado se comprueban de nuevo bajo candado en cada intento."""
    try:
        organization_id = uuid.UUID(str(run.payload["organization_id"]))
    except (KeyError, ValueError, TypeError) as exc:
        raise PermanentJobError("Identificador de organización inválido.") from exc
    with run.open_session() as session, session.begin():
        now = session.scalar(select(func.now()))
        if now is None:
            raise RuntimeError("La base no devolvió la fecha actual.")
        subscription_expiration.expire(session, organization_id, now)


def build_export(run: JobRun) -> None:
    try:
        export_id = uuid.UUID(str(run.payload["export_id"]))
        organization_id = uuid.UUID(str(run.payload["organization_id"]))
    except (KeyError, ValueError, TypeError) as exc:
        raise PermanentJobError("Identificadores de exportación inválidos.") from exc
    export_build.build(
        run.open_session,
        run.context.settings,
        build_key_wrapper(run.context.settings),
        export_id,
        organization_id,
        run.renew_lease,
    )


def stamp_evidence(run: JobRun) -> None:
    try:
        evidence_id = uuid.UUID(str(run.payload["evidence_id"]))
        case_id = uuid.UUID(str(run.payload["case_id"]))
        organization_id = uuid.UUID(str(run.payload["organization_id"]))
    except (KeyError, ValueError, TypeError) as exc:
        raise PermanentJobError("Identificadores de evidencia inválidos.") from exc
    evidence_stamp.stamp(run.open_session, evidence_id, case_id, organization_id)


def anchor_custody(run: JobRun) -> None:
    try:
        case_id = uuid.UUID(str(run.payload["case_id"]))
        organization_id = uuid.UUID(str(run.payload["organization_id"]))
    except (KeyError, ValueError, TypeError) as exc:
        raise PermanentJobError("Identificadores de custodia inválidos.") from exc
    custody_anchor.anchor(run.open_session, case_id, organization_id)


def purge_case_job(run: JobRun) -> None:
    """case_purge (SEQ-004): borra los objetos cifrados y el expediente de un caso cuya llave ya
    se destruyó. Repetirla no cambia el resultado."""
    try:
        case_id = uuid.UUID(str(run.payload["case_id"]))
        organization_id = uuid.UUID(str(run.payload["organization_id"]))
        requested_by = uuid.UUID(str(run.payload["requested_by"]))
    except (KeyError, ValueError, TypeError) as exc:
        raise PermanentJobError("Identificadores de eliminación inválidos.") from exc
    case_deletion.purge(
        run.open_session, run.context.settings, case_id, organization_id, requested_by
    )


def reconcile_payment(run: JobRun) -> None:
    """payment_reconcile (EVT-007): si el webhook de Wompi ya activó o rechazó el cobro, esto
    encuentra la misma clave de deduplicación y no hace nada; si nunca llegó, lo resuelve con
    la respuesta de Wompi en vez de dejarlo pendiente para siempre."""
    transaction_id = str(run.payload.get("transaction_id", ""))
    if not transaction_id:
        raise PermanentJobError("Falta el identificador de la transacción.")
    creds = wompi.credenciales_de(run.context.settings)
    try:
        with run.open_session() as session, session.begin():
            payments.reconciliar(session, creds, transaction_id)
    except wompi.WompiRechazadoError as exc:
        raise PermanentJobError(str(exc)) from exc


def expire_export(run: JobRun) -> None:
    try:
        export_id = uuid.UUID(str(run.payload["export_id"]))
        organization_id = uuid.UUID(str(run.payload["organization_id"]))
    except (KeyError, ValueError, TypeError) as exc:
        raise PermanentJobError("Identificadores de exportación inválidos.") from exc
    export_expiration.expire(run.open_session, run.context.settings, export_id, organization_id)


# Los demás tipos de JOB_KINDS llegan con sus historias. Una tarea sin manejador se entierra.
HANDLERS: Final[Mapping[str, Handler]] = {
    "email_send": send_email,
    "subscription_expire": expire_subscription,
    "export_build": build_export,
    "export_expire": expire_export,
    "tsa_stamp": stamp_evidence,
    "custody_anchor": anchor_custody,
    "case_purge": purge_case_job,
    "payment_reconcile": reconcile_payment,
}
