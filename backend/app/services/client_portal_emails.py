"""Correo con el enlace del portal del cliente (ADR-054).

El trabajador firma el enlace justo antes de enviarlo, con la versión que tenga el acceso en ese
momento: si el despacho lo reenvió o lo revocó antes de que corra la tarea, no sale el anterior.
El correo no nombra el caso: dice quién invita, no de qué trata.
"""

import html
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.adapters.email import REPLY_TO, OutgoingEmail
from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import ClientPortalAccess, Organization
from app.services.client_portal import INVITE_TEMPLATE, portal_link
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
