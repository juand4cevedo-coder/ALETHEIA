"""Correos que envía el trabajador a partir de la tarea email_send.

Cada historia registra su plantilla con @email_template: una función que recibe la sesión, el
payload (solo identificadores) y la configuración, y arma el correo con los datos vigentes en ese
momento. Así el payload no guarda correos ni nombres, y un enlace firmado se genera justo antes
de enviarse. Si al momento de enviar ya no hay nada que decir, como una cuenta que se verificó
mientras la tarea esperaba, la plantilla devuelve None y no sale ningún correo.
"""

from collections.abc import Callable
from typing import Any, Final

from sqlalchemy.orm import Session

from app.adapters.email import OutgoingEmail
from app.core.config import Settings
from app.services.jobs import PermanentJobError

type EmailBuilder = Callable[[Session, dict[str, Any], Settings], OutgoingEmail | None]

EMAIL_BUILDERS: Final[dict[str, EmailBuilder]] = {}


def email_template(name: str) -> Callable[[EmailBuilder], EmailBuilder]:
    """Registra la función que arma el correo de la plantilla name."""

    def register(builder: EmailBuilder) -> EmailBuilder:
        if name in EMAIL_BUILDERS:
            msg = f"La plantilla {name} ya está registrada."
            raise ValueError(msg)
        EMAIL_BUILDERS[name] = builder
        return builder

    return register


def build_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    """Arma el correo que pide el payload de una tarea email_send, o None si sobra."""
    name = payload.get("template")
    builder = EMAIL_BUILDERS.get(name) if isinstance(name, str) else None
    if builder is None:
        msg = f"Plantilla de correo desconocida: {name!r}."
        raise PermanentJobError(msg)
    return builder(session, payload, settings)
