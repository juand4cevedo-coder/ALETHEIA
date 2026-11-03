"""Qué hace el trabajador con cada tipo de tarea de jobs."""

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any, Final

from sqlalchemy.orm import Session

from app.adapters.email import EmailDeliveryError, EmailSender
from app.services import notifications
from app.services.jobs import PermanentJobError


@dataclass(frozen=True, slots=True)
class WorkerContext:
    """Los servicios externos que usan los manejadores."""

    email: EmailSender


type Handler = Callable[[Session, dict[str, Any], WorkerContext], None]


def send_email(session: Session, payload: dict[str, Any], context: WorkerContext) -> None:
    """email_send (EVT-003): arma el correo con los datos de hoy y lo entrega."""
    email = notifications.build_email(session, payload)
    try:
        context.email.send(email)
    except EmailDeliveryError as exc:
        if exc.permanent:
            raise PermanentJobError(str(exc)) from None
        raise


# Los demás tipos de JOB_KINDS llegan con sus historias. Una tarea sin manejador se entierra.
HANDLERS: Final[Mapping[str, Handler]] = {"email_send": send_email}
