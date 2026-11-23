"""Correos de la recuperación del segundo factor (ADR-053).

El trabajador los arma justo antes de enviarlos: los enlaces se firman en ese momento y, si la
recuperación ya no está abierta cuando la tarea corre, no sale ningún aviso de inicio.
"""

import html
import uuid
from typing import Any, Final

from sqlalchemy.orm import Session

from app.adapters.email import REPLY_TO, OutgoingEmail
from app.core.config import Settings
from app.models import TwoFactorRecovery, User, UserTwoFactor
from app.services.email_layout import email_layout
from app.services.jobs import PermanentJobError
from app.services.notifications import email_template
from app.services.organization_emails import colombian_datetime
from app.services.two_factor_recovery import (
    CANCELED_TEMPLATE,
    COMPLETED_TEMPLATE,
    CONFIRM_LINK_LIFETIME,
    OWNER_NOTICE_TEMPLATE,
    PATH,
    REQUEST_TEMPLATE,
    STARTED_TEMPLATE,
    cancel_link,
    confirm_link,
)

_MINUTES: Final = int(CONFIRM_LINK_LIFETIME.total_seconds() // 60)


def _user(session: Session, payload: dict[str, Any]) -> User | None:
    try:
        return session.get(User, uuid.UUID(str(payload["user_id"])))
    except KeyError, ValueError:
        msg = "La tarea de correo no trae un user_id válido."
        raise PermanentJobError(msg) from None


def _open_recovery(session: Session, payload: dict[str, Any]) -> TwoFactorRecovery | None:
    try:
        recovery = session.get(TwoFactorRecovery, uuid.UUID(str(payload["recovery_id"])))
    except KeyError, ValueError:
        msg = "La tarea de correo no trae un recovery_id válido."
        raise PermanentJobError(msg) from None
    if recovery is None or recovery.canceled_at is not None or recovery.completed_at is not None:
        return None
    return recovery


@email_template(REQUEST_TEMPLATE)
def request_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    """Enlace para confirmar el pedido. Si la cuenta ya no tiene segundo factor, no se envía."""
    user = _user(session, payload)
    if user is None or user.status != "active":
        return None
    record = session.get(UserTwoFactor, user.id)
    if record is None or record.enabled_at is None:
        return None
    link = confirm_link(settings, user, record.enabled_at)
    name = user.full_name
    return OutgoingEmail(
        to=user.email,
        subject="Recupere el segundo factor de su cuenta de ALETHEIA",
        text=(
            f"Hola, {name}:\n\n"
            "Recibimos un pedido para recuperar el segundo factor de su cuenta, porque ya no "
            "tiene su teléfono ni sus códigos de respaldo. Para seguir, abra este enlace y "
            f"confirme con su contraseña:\n{link}\n\n"
            f"El enlace vence en {_MINUTES} minutos. Después viene una espera de seguridad de "
            "24 horas, durante la cual usted y los dueños de su despacho podrán cancelar el "
            "pedido.\n\n"
            "Si usted no lo pidió, ignore este mensaje: su cuenta no cambia.\n\n"
            "ALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [
                "Recibimos un pedido para recuperar el segundo factor de su cuenta, porque ya "
                "no tiene su teléfono ni sus códigos de respaldo. Para seguir, confirme con "
                "su contraseña en este botón.",
                "Después viene una espera de seguridad de 24 horas, durante la cual usted y "
                "los dueños de su despacho podrán cancelar el pedido.",
            ],
            ("Confirmar el pedido", link),
            f"El enlace vence en {_MINUTES} minutos. Si usted no lo pidió, ignore este "
            "mensaje: su cuenta no cambia.",
            site_url=settings.public_url,
        ),
    )


@email_template(STARTED_TEMPLATE)
def started_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    """Aviso a la persona: la espera empezó, cuándo termina y cómo cancelarla."""
    user = _user(session, payload)
    recovery = _open_recovery(session, payload)
    if user is None or recovery is None:
        return None
    link = cancel_link(settings, recovery)
    available = colombian_datetime(recovery.available_at)
    name = user.full_name
    return OutgoingEmail(
        to=user.email,
        subject="Empezó la recuperación del segundo factor de su cuenta",
        text=(
            f"Hola, {name}:\n\n"
            "Confirmó el pedido de recuperar el segundo factor de su cuenta de ALETHEIA. "
            f"Podrá terminar la recuperación a partir del {available} (hora de Colombia), "
            f"ingresando a:\n{settings.public_url}{PATH}\n\n"
            "Si no fue usted, cancele el pedido ahora mismo con este enlace y cambie su "
            f"contraseña:\n{link}\n\n"
            f"También puede escribirnos a {REPLY_TO}.\n\n"
            "ALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [
                "Confirmó el pedido de recuperar el segundo factor de su cuenta de ALETHEIA.",
                f"Podrá terminar la recuperación a partir del {html.escape(available)} "
                "(hora de Colombia).",
                "Si no fue usted, cancele el pedido ahora mismo y cambie su contraseña.",
            ],
            ("Cancelar la recuperación", link),
            f"También puede escribirnos a {html.escape(REPLY_TO)}. Si fue usted, no tiene "
            "que hacer nada hasta la fecha indicada.",
            site_url=settings.public_url,
        ),
    )


@email_template(OWNER_NOTICE_TEMPLATE)
def owner_notice_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    """Aviso a un dueño del despacho: alguien de su equipo pidió recuperar su segundo factor."""
    owner = _user(session, payload)
    recovery = _open_recovery(session, payload)
    if owner is None or owner.status != "active" or recovery is None:
        return None
    member = session.get(User, recovery.user_id)
    if member is None:
        return None
    link = cancel_link(settings, recovery)
    available = colombian_datetime(recovery.available_at)
    who = member.full_name
    return OutgoingEmail(
        to=owner.email,
        subject=f"{who} pidió recuperar su segundo factor en ALETHEIA",
        text=(
            f"Hola, {owner.full_name}:\n\n"
            f"{who} ({member.email}), de su despacho, confirmó el pedido de recuperar el "
            "segundo factor de su cuenta, porque dice no tener su teléfono ni sus códigos de "
            f"respaldo. Podrá terminar la recuperación a partir del {available} (hora de "
            "Colombia).\n\n"
            "Si no es alguien que haya perdido su teléfono, o no está seguro, cancele el "
            f"pedido con este enlace:\n{link}\n\n"
            "Después comuníquese con esa persona por otro medio. El pedido y su cancelación "
            "quedan en la auditoría del despacho.\n\n"
            "ALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(owner.full_name)}:",
            [
                f"{html.escape(who)} ({html.escape(member.email)}), de su despacho, "
                "confirmó el pedido de recuperar el segundo factor de su cuenta, porque dice "
                "no tener su teléfono ni sus códigos de respaldo.",
                f"Podrá terminar la recuperación a partir del {html.escape(available)} (hora "
                "de Colombia).",
                "Si no es alguien que haya perdido su teléfono, o no está seguro, cancele el "
                "pedido y comuníquese con esa persona por otro medio.",
            ],
            ("Cancelar la recuperación", link),
            "El pedido y su cancelación quedan en la auditoría del despacho.",
            site_url=settings.public_url,
        ),
    )


@email_template(CANCELED_TEMPLATE)
def canceled_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    """Aviso a la persona: la recuperación se canceló y su segundo factor sigue como estaba."""
    user = _user(session, payload)
    if user is None:
        return None
    reset = f"{settings.public_url}/recuperar"
    name = user.full_name
    return OutgoingEmail(
        to=user.email,
        subject="Se canceló la recuperación del segundo factor de su cuenta",
        text=(
            f"Hola, {name}:\n\n"
            "Se canceló el pedido de recuperar el segundo factor de su cuenta de ALETHEIA. "
            "Su segundo factor sigue activo, sin cambios.\n\n"
            "Si no fue usted quien lo pidió, cambie su contraseña de inmediato en:\n"
            f"{reset}\ny escríbanos a {REPLY_TO}.\n\n"
            "ALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [
                "Se canceló el pedido de recuperar el segundo factor de su cuenta de ALETHEIA. "
                "Su segundo factor sigue activo, sin cambios."
            ],
            ("Cambiar mi contraseña", reset),
            f"Si no fue usted quien lo pidió, cambie su contraseña de inmediato y escríbanos "
            f"a {html.escape(REPLY_TO)}.",
            site_url=settings.public_url,
        ),
    )


@email_template(COMPLETED_TEMPLATE)
def completed_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    """Aviso a la persona: el segundo factor se desactivó y las sesiones se cerraron."""
    user = _user(session, payload)
    if user is None:
        return None
    sign_in = f"{settings.public_url}/ingresar"
    name = user.full_name
    return OutgoingEmail(
        to=user.email,
        subject="Su segundo factor de ALETHEIA se recuperó",
        text=(
            f"Hola, {name}:\n\n"
            "Terminó la recuperación: el segundo factor de su cuenta quedó desactivado y "
            "cerramos las sesiones abiertas en todos sus dispositivos. Vuelva a ingresar y "
            "active uno nuevo desde Mi cuenta:\n"
            f"{sign_in}\n\n"
            "Si no fue usted, restablezca su contraseña de inmediato y escríbanos a "
            f"{REPLY_TO}.\n\n"
            "ALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [
                "Terminó la recuperación: el segundo factor de su cuenta quedó desactivado y "
                "cerramos las sesiones abiertas en todos sus dispositivos.",
                "Vuelva a ingresar y active uno nuevo desde Mi cuenta.",
            ],
            ("Ingresar a ALETHEIA", sign_in),
            f"Si no fue usted, restablezca su contraseña de inmediato y escríbanos a "
            f"{html.escape(REPLY_TO)}.",
            site_url=settings.public_url,
        ),
    )
