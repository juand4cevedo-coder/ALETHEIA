"""Plantillas de los correos de la cuenta: la verificación del correo, el aviso de un registro
repetido, el enlace para restablecer la contraseña y el aviso de que cambió. El trabajador las
arma justo antes de enviar, con los datos vigentes.

Cada correo va en texto y en HTML. El HTML usa estilos en línea, porque los clientes de correo
ignoran las hojas de estilo, y escapa todo lo que viene de la persona, como su nombre.
"""

import html
import uuid
from typing import Any, Final

from sqlalchemy.orm import Session

from app.adapters.email import REPLY_TO, OutgoingEmail
from app.core.config import Settings
from app.models import User
from app.services.credentials import (
    CHANGED_TEMPLATE,
    RESET_LINK_LIFETIME,
    RESET_TEMPLATE,
    reset_link,
)
from app.services.email_layout import email_layout
from app.services.jobs import PermanentJobError
from app.services.notifications import email_template
from app.services.verification import (
    ACCOUNT_EXISTS_TEMPLATE,
    LINK_LIFETIME,
    VERIFICATION_TEMPLATE,
    verification_link,
)

SIGN_IN_PATH: Final = "/ingresar"
FORGOT_PATH: Final = "/recuperar"
_HOURS: Final = int(LINK_LIFETIME.total_seconds() // 3600)
_RESET_MINUTES: Final = int(RESET_LINK_LIFETIME.total_seconds() // 60)


def _user(session: Session, payload: dict[str, Any]) -> User | None:
    try:
        user_id = uuid.UUID(str(payload["user_id"]))
    except KeyError, ValueError:
        msg = "La tarea de correo no trae un user_id válido."
        raise PermanentJobError(msg) from None
    return session.get(User, user_id)


@email_template(VERIFICATION_TEMPLATE)
def verification_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    """Enlace para verificar el correo. Si la cuenta ya no existe o ya se verificó, no se envía."""
    user = _user(session, payload)
    if user is None or user.email_verified_at is not None:
        return None
    link = verification_link(settings, user.id, user.email)
    name = user.full_name
    return OutgoingEmail(
        to=user.email,
        subject="Verifique su correo en ALETHEIA",
        text=(
            f"Hola, {name}:\n\n"
            "Para activar su cuenta en ALETHEIA, abra este enlace:\n"
            f"{link}\n\n"
            f"El enlace vence en {_HOURS} horas y sirve una sola vez.\n\n"
            "Si usted no creó esta cuenta, ignore este mensaje.\n\n"
            "ALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            ["Para activar su cuenta en ALETHEIA, verifique su correo con este botón."],
            ("Verificar mi correo", link),
            f"El enlace vence en {_HOURS} horas y sirve una sola vez. Si usted no creó esta "
            "cuenta, ignore este mensaje.",
            site_url=settings.public_url,
        ),
    )


@email_template(ACCOUNT_EXISTS_TEMPLATE)
def account_exists_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    """Aviso a quien ya tiene cuenta: alguien intentó registrarse con su correo."""
    user = _user(session, payload)
    if user is None:
        return None
    sign_in = f"{settings.public_url}{SIGN_IN_PATH}"
    name = user.full_name
    return OutgoingEmail(
        to=user.email,
        subject="Alguien intentó crear una cuenta con su correo",
        text=(
            f"Hola, {name}:\n\n"
            "Alguien intentó abrir una cuenta en ALETHEIA con este correo, que ya tiene una. "
            f"Si fue usted, ingrese con su contraseña en:\n{sign_in}\n\n"
            "Si no fue usted, no tiene que hacer nada: su cuenta no cambió.\n\n"
            "ALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [
                "Alguien intentó abrir una cuenta en ALETHEIA con este correo, que ya tiene "
                "una. Si fue usted, ingrese con su contraseña."
            ],
            ("Ingresar a ALETHEIA", sign_in),
            "Si no fue usted, no tiene que hacer nada: su cuenta no cambió.",
            site_url=settings.public_url,
        ),
    )


@email_template(RESET_TEMPLATE)
def password_reset_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    """Enlace para restablecer la contraseña. Si la cuenta ya no existe o está bloqueada, no
    se envía. El enlace se firma ahora, con la contraseña vigente al enviar."""
    user = _user(session, payload)
    if user is None or user.status != "active":
        return None
    link = reset_link(settings, user)
    name = user.full_name
    return OutgoingEmail(
        to=user.email,
        subject="Restablezca su contraseña de ALETHEIA",
        text=(
            f"Hola, {name}:\n\n"
            "Recibimos una solicitud para restablecer la contraseña de su cuenta. Para crear "
            f"una nueva, abra este enlace:\n{link}\n\n"
            f"El enlace vence en {_RESET_MINUTES} minutos y sirve una sola vez. Al cambiar la "
            "contraseña cerraremos las sesiones abiertas en todos sus dispositivos.\n\n"
            "Si usted no lo pidió, ignore este mensaje: su contraseña no cambia.\n\n"
            "ALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [
                "Recibimos una solicitud para restablecer la contraseña de su cuenta. Para "
                "crear una nueva, use este botón.",
                "Al cambiarla cerraremos las sesiones abiertas en todos sus dispositivos.",
            ],
            ("Crear una contraseña nueva", link),
            f"El enlace vence en {_RESET_MINUTES} minutos y sirve una sola vez. Si usted no "
            "lo pidió, ignore este mensaje: su contraseña no cambia.",
            site_url=settings.public_url,
        ),
    )


@email_template(CHANGED_TEMPLATE)
def password_changed_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    """Aviso de que la contraseña cambió, para que la persona actúe si no fue ella."""
    user = _user(session, payload)
    if user is None:
        return None
    recover = f"{settings.public_url}{FORGOT_PATH}"
    name = user.full_name
    return OutgoingEmail(
        to=user.email,
        subject="La contraseña de su cuenta cambió",
        text=(
            f"Hola, {name}:\n\n"
            "Le confirmamos que la contraseña de su cuenta en ALETHEIA acaba de cambiar y que "
            "cerramos las sesiones abiertas en sus otros dispositivos.\n\n"
            "Si no fue usted, restablézcala de inmediato en:\n"
            f"{recover}\n"
            f"y escríbanos a {REPLY_TO}.\n\n"
            "ALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [
                "Le confirmamos que la contraseña de su cuenta en ALETHEIA acaba de cambiar y "
                "que cerramos las sesiones abiertas en sus otros dispositivos."
            ],
            ("Restablecer mi contraseña", recover),
            f"Si fue usted, no tiene que hacer nada. Si no, restablézcala de inmediato y "
            f"escríbanos a {html.escape(REPLY_TO)}.",
            site_url=settings.public_url,
        ),
    )
