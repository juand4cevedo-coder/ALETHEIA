"""Verificación del correo (HU-006, RF-007): el enlace firmado y las tareas que envían los
correos de la cuenta.

El enlace vale 24 horas y una sola vez: lleva el sello del correo todavía sin verificar, así que
deja de valer en cuanto el correo se verifica o cambia (app.core.tokens).
"""

import datetime
import uuid
from typing import Final

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.tokens import LinkPurpose, issue_link
from app.services import jobs

LINK_LIFETIME: Final = datetime.timedelta(hours=24)
VERIFICATION_TEMPLATE: Final = "email_verification"
ACCOUNT_EXISTS_TEMPLATE: Final = "account_exists"
VERIFY_PATH: Final = "/verificar-correo"


class SigningKeyMissingError(RuntimeError):
    """Falta ALETHEIA_TOKEN_SIGNING_KEY: sin ella no se pueden firmar enlaces."""


def signing_key(settings: Settings) -> str:
    """La clave maestra de firma, o un error claro si el entorno no la tiene."""
    if settings.token_signing_key is None:
        msg = "Falta ALETHEIA_TOKEN_SIGNING_KEY para firmar los enlaces de los correos."
        raise SigningKeyMissingError(msg)
    return settings.token_signing_key.get_secret_value()


def verification_state(email: str) -> str:
    """El estado que sella el enlace: el correo, sin distinguir mayúsculas."""
    return email.lower()


def verification_link(settings: Settings, user_id: uuid.UUID, email: str) -> str:
    """Enlace de verificación. El token va en el fragmento (#t=…): el navegador nunca lo envía
    al servidor, así que no queda en los registros de Caddy ni en la cabecera Referer."""
    token = issue_link(
        signing_key(settings),
        LinkPurpose.EMAIL_VERIFICATION,
        user_id,
        verification_state(email),
        LINK_LIFETIME,
    )
    return f"{settings.public_url}{VERIFY_PATH}#t={token}"


def _enqueue(session: Session, template: str, user_id: uuid.UUID) -> None:
    # Cada envío es una tarea propia: dos solicitudes legítimas no se funden en una.
    jobs.enqueue(
        session,
        "email_send",
        {"template": template, "user_id": str(user_id)},
        f"{template}:{user_id}:{uuid.uuid7()}",
    )


def enqueue_verification(session: Session, user_id: uuid.UUID) -> None:
    """Encola el correo de verificación en la transacción de session."""
    _enqueue(session, VERIFICATION_TEMPLATE, user_id)


def enqueue_account_exists(session: Session, user_id: uuid.UUID) -> None:
    """Encola el aviso de que alguien intentó registrarse con un correo que ya tiene cuenta."""
    _enqueue(session, ACCOUNT_EXISTS_TEMPLATE, user_id)
