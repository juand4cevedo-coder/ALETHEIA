"""Qué hace el trabajador con cada tipo de tarea de jobs.

Ningún manejador deja una transacción abierta mientras habla con un servicio externo: lee y
escribe la base en transacciones cortas que abre con run.open_session y hace la llamada de red
después de confirmarlas (ADR-038). La cola entrega cada tarea al menos una vez, así que cada
manejador define cómo se comporta si se repite; la tabla está en ADR-038.
"""

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any, Final

from sqlalchemy.orm import Session

from app.adapters.email import EmailDeliveryError, EmailSender
from app.core.config import Settings

# Registran las plantillas de correo: sin estos imports, el trabajador no las conoce.
from app.services import account_emails as _account_emails  # noqa: F401
from app.services import notifications
from app.services import organization_emails as _organization_emails  # noqa: F401
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


# Los demás tipos de JOB_KINDS llegan con sus historias. Una tarea sin manejador se entierra.
HANDLERS: Final[Mapping[str, Handler]] = {"email_send": send_email}
