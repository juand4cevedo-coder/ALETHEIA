"""Correo con el enlace del portal del cliente (ADR-054).

El trabajador firma el enlace justo antes de enviarlo, con la versión que tenga el acceso en ese
momento: si el despacho lo reenvió o lo revocó antes de que corra la tarea, no sale el anterior.
El correo no nombra el caso: dice quién invita, no de qué trata.
"""

import datetime
import html
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.adapters.email import REPLY_TO, OutgoingEmail
from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import Case, ClientPortalAccess, Organization, User
from app.services.client_portal import (
    INVITE_TEMPLATE,
    MESSAGE_TEMPLATE,
    NEWS_TEMPLATE,
    portal_link,
)
from app.services.email_layout import email_layout
from app.services.jobs import PermanentJobError
from app.services.notifications import email_template
from app.services.organization_emails import colombian_datetime


@email_template(INVITE_TEMPLATE)
def invite_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    try:
        access_id = uuid.UUID(str(payload["access_id"]))
        organization_id = uuid.UUID(str(payload["organization_id"]))
    except KeyError, ValueError:
        msg = "La tarea de correo del portal no trae identificadores válidos."
        raise PermanentJobError(msg) from None
    set_tenant(session, TenantContext(organization_id=organization_id))
    access = session.get(ClientPortalAccess, access_id)
    organization = session.get(Organization, organization_id)
    if access is None or organization is None or access.revoked_at is not None:
        return None
    link = portal_link(settings, access)
    name = access.client_name
    where = organization.name
    expires = colombian_datetime(access.expires_at)
    renewed = payload.get("renewed") is True
    intro = (
        "Pidió un enlace nuevo para entrar a su espacio del caso. El anterior ya no sirve."
        if renewed
        else f"{where} le abrió un espacio en ALETHEIA para que siga su caso. Allí verá los "
        "avisos que el despacho decida compartirle."
    )
    return OutgoingEmail(
        to=access.client_email,
        subject=(
            f"Su enlace nuevo a {where} en ALETHEIA"
            if renewed
            else f"{where} le abrió su espacio en ALETHEIA"
        ),
        text=(
            f"Hola, {name}:\n\n"
            f"{intro}\n\n"
            f"Para entrar, abra este enlace:\n{link}\n\n"
            f"El enlace vence el {expires} (hora de Colombia). Es personal: no lo reenvíe. "
            "Si no esperaba este mensaje, ignórelo; no pasa nada si no lo abre.\n\n"
            f"Dudas: {REPLY_TO}.\n\n"
            "ALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [
                html.escape(intro),
                "El enlace es personal: no lo reenvíe.",
            ],
            ("Entrar a mi espacio", link),
            f"El enlace vence el {html.escape(expires)} (hora de Colombia). Si no esperaba "
            "este mensaje, ignórelo.",
            site_url=settings.public_url,
        ),
    )


@email_template(MESSAGE_TEMPLATE)
def message_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    """Aviso a quien lleva el caso: un cliente le escribió. No copia el mensaje, porque el correo
    viaja fuera de ALETHEIA; hay que abrir el caso para leerlo."""
    try:
        user_id = uuid.UUID(str(payload["user_id"]))
        case_id = uuid.UUID(str(payload["case_id"]))
        access_id = uuid.UUID(str(payload["access_id"]))
        organization_id = uuid.UUID(str(payload["organization_id"]))
    except KeyError, ValueError:
        msg = "La tarea de correo del portal no trae identificadores válidos."
        raise PermanentJobError(msg) from None
    set_tenant(session, TenantContext(organization_id=organization_id))
    user = session.get(User, user_id)
    case = session.get(Case, case_id)
    access = session.get(ClientPortalAccess, access_id)
    if user is None or user.status != "active" or case is None or access is None:
        return None
    link = f"{settings.public_url}/app/casos/{case.id}"
    client = access.client_name
    title = case.title
    name = user.full_name
    return OutgoingEmail(
        to=user.email,
        subject=f"{client} le escribió desde el portal del cliente",
        text=(
            f"Hola, {name}:\n\n"
            f"{client} le escribió desde el portal del cliente del caso «{title}». Por "
            "seguridad no copiamos el mensaje aquí: ábralo en el caso, en la pestaña "
            f"«Portal del cliente».\n{link}\n\n"
            "Si hay más mensajes en los próximos minutos, no le enviaremos otro correo.\n\n"
            "ALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [
                f"<strong>{html.escape(client)}</strong> le escribió desde el portal del "
                f"cliente del caso «{html.escape(title)}».",
                "Por seguridad no copiamos el mensaje aquí: ábralo en el caso, en la "
                "pestaña «Portal del cliente».",
            ],
            ("Abrir el caso", link),
            "Si hay más mensajes en los próximos minutos, no le enviaremos otro correo.",
            site_url=settings.public_url,
        ),
    )


@email_template(NEWS_TEMPLATE)
def news_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    """Aviso al cliente: hay novedades en su espacio. No dice cuáles ni nombra el caso, porque el
    correo viaja fuera de ALETHEIA; el contenido se lee en el portal."""
    try:
        access_id = uuid.UUID(str(payload["access_id"]))
        organization_id = uuid.UUID(str(payload["organization_id"]))
    except KeyError, ValueError:
        msg = "La tarea de correo del portal no trae identificadores válidos."
        raise PermanentJobError(msg) from None
    set_tenant(session, TenantContext(organization_id=organization_id))
    access = session.get(ClientPortalAccess, access_id)
    organization = session.get(Organization, organization_id)
    now = datetime.datetime.now(datetime.UTC)
    if (
        access is None
        or organization is None
        or access.revoked_at is not None
        or access.expires_at <= now
    ):
        return None
    link = portal_link(settings, access)
    name = access.client_name
    where = organization.name
    return OutgoingEmail(
        to=access.client_email,
        subject=f"Hay novedades en su espacio de {where}",
        text=(
            f"Hola, {name}:\n\n"
            f"{where} publicó novedades en su espacio de ALETHEIA. Por seguridad no las "
            f"copiamos en este correo; para verlas, abra:\n{link}\n\n"
            "El enlace es personal: no lo reenvíe. Si hay más novedades en la próxima hora, "
            "no le enviaremos otro correo.\n\n"
            "ALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [
                f"<strong>{html.escape(where)}</strong> publicó novedades en su espacio de "
                "ALETHEIA. Por seguridad no las copiamos en este correo.",
                "El enlace es personal: no lo reenvíe.",
            ],
            ("Ver las novedades", link),
            "Si hay más novedades en la próxima hora, no le enviaremos otro correo.",
            site_url=settings.public_url,
        ),
    )
