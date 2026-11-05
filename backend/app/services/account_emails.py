"""Plantillas de los correos de la cuenta: la verificación del correo y el aviso de un registro
repetido. El trabajador las arma justo antes de enviar, con los datos vigentes.

Cada correo va en texto y en HTML. El HTML usa estilos en línea, porque los clientes de correo
ignoran las hojas de estilo, y escapa todo lo que viene de la persona, como su nombre.
"""

import html
import uuid
from typing import Any, Final

from sqlalchemy.orm import Session

from app.adapters.email import OutgoingEmail
from app.core.config import Settings
from app.models import User
from app.services.jobs import PermanentJobError
from app.services.notifications import email_template
from app.services.verification import (
    ACCOUNT_EXISTS_TEMPLATE,
    LINK_LIFETIME,
    VERIFICATION_TEMPLATE,
    verification_link,
)

SIGN_IN_PATH: Final = "/ingresar"
_HOURS: Final = int(LINK_LIFETIME.total_seconds() // 3600)

# Colores del sitio: el correo se lee como parte del mismo producto.
_PAGE: Final = "#070b14"
_CARD: Final = "#0e1626"
_TEXT: Final = "#e8eef7"
_MUTED: Final = "#9aa8bd"
_ACTION: Final = "#6cb8f0"
_ACTION_TEXT: Final = "#04101f"


def _user(session: Session, payload: dict[str, Any]) -> User | None:
    try:
        user_id = uuid.UUID(str(payload["user_id"]))
    except KeyError, ValueError:
        msg = "La tarea de correo no trae un user_id válido."
        raise PermanentJobError(msg) from None
    return session.get(User, user_id)


def _html(greeting: str, paragraphs: list[str], action: tuple[str, str], closing: str) -> str:
    """Un correo de una columna. Los textos ya llegan escapados."""
    label, url = action
    body = "".join(
        f'<p style="margin:0 0 16px;color:{_TEXT};font-size:16px;line-height:24px">{text}</p>'
        for text in paragraphs
    )
    button = (
        f'<p style="margin:24px 0"><a href="{html.escape(url)}" style="display:inline-block;'
        f"padding:12px 20px;border-radius:6px;background:{_ACTION};color:{_ACTION_TEXT};"
        f'font-weight:600;text-decoration:none">{html.escape(label)}</a></p>'
    )
    return (
        '<!doctype html><html lang="es"><body style="margin:0;padding:0;'
        f'background:{_PAGE}">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:{_PAGE};padding:32px 16px"><tr><td align="center">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="max-width:560px;background:{_CARD};border-radius:12px;padding:32px;'
        'font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">'
        f'<tr><td><p style="margin:0 0 24px;color:{_TEXT};font-size:14px;font-weight:700;'
        'letter-spacing:0.08em">ALETHEIA</p>'
        f'<p style="margin:0 0 16px;color:{_TEXT};font-size:16px;line-height:24px">'
        f"{greeting}</p>{body}{button}"
        f'<p style="margin:0;color:{_MUTED};font-size:13px;line-height:20px">{closing}</p>'
        "</td></tr></table></td></tr></table></body></html>"
    )


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
        html=_html(
            f"Hola, {html.escape(name)}:",
            ["Para activar su cuenta en ALETHEIA, verifique su correo con este botón."],
            ("Verificar mi correo", link),
            f"El enlace vence en {_HOURS} horas y sirve una sola vez. Si usted no creó esta "
            "cuenta, ignore este mensaje.",
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
        html=_html(
            f"Hola, {html.escape(name)}:",
            [
                "Alguien intentó abrir una cuenta en ALETHEIA con este correo, que ya tiene "
                "una. Si fue usted, ingrese con su contraseña."
            ],
            ("Ingresar a ALETHEIA", sign_in),
            "Si no fue usted, no tiene que hacer nada: su cuenta no cambió.",
        ),
    )
