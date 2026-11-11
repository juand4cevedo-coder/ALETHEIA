"""Correo de invitación a una organización (HU-011). El trabajador lo arma justo antes de
enviarlo: genera en ese momento el token del enlace y guarda solo su SHA-256 (ADR-035).

Si la invitación ya no está abierta cuando la tarea corre, porque la revocaron o venció, no
sale ningún correo. Si la tarea se reintenta, el token cambia y solo el último enlace sirve.
"""

import datetime
import html
import uuid
from typing import Any, Final

from sqlalchemy.orm import Session

from app.adapters.email import OutgoingEmail
from app.core.config import Settings
from app.core.tokens import new_opaque_token, opaque_token_hash
from app.db.tenancy import TenantContext, set_tenant
from app.models import Invitation, Organization, User
from app.services.email_layout import email_layout
from app.services.jobs import PermanentJobError
from app.services.members import INVITATION_TEMPLATE, accept_link
from app.services.notifications import email_template

# Colombia no tiene horario de verano: la hora oficial es UTC-5 todo el año.
_COLOMBIA: Final = datetime.timezone(datetime.timedelta(hours=-5))
_MONTHS: Final = (
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
)
# Cómo se nombra cada rol en el correo, con el artículo que lo acompaña.
ROLE_PHRASES: Final = {
    "admin": "administrador",
    "lawyer": "abogado",
    "assistant": "asistente",
}


def colombian_datetime(moment: datetime.datetime) -> str:
    """La fecha y la hora de Colombia en palabras, por ejemplo «10 de noviembre de 2026 a las
    3:05 p. m.»."""
    local = moment.astimezone(_COLOMBIA)
    hour = local.hour % 12 or 12
    suffix = "a. m." if local.hour < 12 else "p. m."
    return (
        f"{local.day} de {_MONTHS[local.month - 1]} de {local.year} a las "
        f"{hour}:{local.minute:02d} {suffix}"
    )


def _ids(payload: dict[str, Any]) -> tuple[uuid.UUID, uuid.UUID]:
    try:
        return uuid.UUID(str(payload["invitation_id"])), uuid.UUID(str(payload["organization_id"]))
    except KeyError, ValueError:
        msg = "La tarea de invitación no trae identificadores válidos."
        raise PermanentJobError(msg) from None


@email_template(INVITATION_TEMPLATE)
def invitation_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    """Invitación con el enlace para aceptarla, a nombre de quien invitó y de su organización."""
    invitation_id, organization_id = _ids(payload)
    # La invitación vive en su organización: sin ese contexto, Row-Level Security no la deja ver.
    set_tenant(session, TenantContext(organization_id=organization_id))
    invitation = session.get(Invitation, invitation_id, with_for_update=True)
    now = datetime.datetime.now(datetime.UTC)
    if (
        invitation is None
        or invitation.accepted_at is not None
        or invitation.revoked_at is not None
        or invitation.expires_at <= now
    ):
        return None
    organization = session.get(Organization, organization_id)
    inviter = session.get(User, invitation.invited_by)
    if organization is None or inviter is None:
        return None

    token = new_opaque_token()
    invitation.token_hash = opaque_token_hash(token)
    session.flush()

    link = accept_link(settings.public_url, token)
    role = ROLE_PHRASES[invitation.role]
    expires = colombian_datetime(invitation.expires_at)
    who = inviter.full_name
    where = organization.name
    return OutgoingEmail(
        to=invitation.email,
        subject=f"Invitación para unirse a {where} en ALETHEIA",
        text=(
            "Hola:\n\n"
            f"{who} le envió una invitación para unirse a {where} en ALETHEIA con el rol de "
            f"{role}. ALETHEIA es la plataforma donde la oficina preserva la evidencia digital "
            "de sus casos.\n\n"
            f"Para aceptarla, abra este enlace:\n{link}\n\n"
            f"La invitación vence el {expires} (hora de Colombia) y sirve una sola vez.\n\n"
            "Si no esperaba esta invitación, ignore este mensaje. "
            "No pasa nada si no la acepta.\n\n"
            "ALETHEIA"
        ),
        html=email_layout(
            "Hola:",
            [
                f"{html.escape(who)} le envió una invitación para unirse a "
                f"<strong>{html.escape(where)}</strong> en ALETHEIA con el rol de {role}.",
                "ALETHEIA es la plataforma donde la oficina preserva la evidencia digital de "
                "sus casos.",
            ],
            ("Aceptar la invitación", link),
            f"La invitación vence el {expires} (hora de Colombia) y sirve una sola vez. Si "
            "no esperaba esta invitación, ignore este mensaje.",
            site_url=settings.public_url,
        ),
    )
