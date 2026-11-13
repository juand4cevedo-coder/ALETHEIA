"""Aceptación de los textos legales vigentes (RF-003, RN-028 y RN-029).

users guarda la última aceptación de cada persona y legal_acceptances (DAT-20) guarda la prueba
de todas: la del registro y la de cada cambio de los textos. Cuando LEGAL_VERSION cambia, quien
aceptó una versión anterior debe aceptar la nueva antes de seguir usando el servicio; mientras
tanto conserva su sesión, su perfil y, cuando existan, la descarga y la exportación de sus
casos, porque los términos prometen que la evidencia nunca queda retenida.
"""

import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.legal import LEGAL_VERSION
from app.models import AuditLog, LegalAcceptance, User
from app.services.audit import audit_ip, audit_user_agent
from app.services.sessions import Principal


class LegalVersionMismatchError(Exception):
    """La persona aceptó una versión de los textos legales que ya no es la vigente."""


def record_registration(session: Session, user: User) -> None:
    """Deja la prueba de la aceptación con que nace una cuenta, en la misma transacción."""
    session.add(
        LegalAcceptance(
            user_id=user.id,
            email=user.email,
            version=user.terms_version,
            context="registration",
            accepted_at=user.consented_at,
        )
    )


def accept_current(
    session: Session,
    principal: Principal,
    version: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> bool:
    """Registra que la persona acepta los textos vigentes. Devuelve False si ya los había
    aceptado: repetir la petición no crea una segunda prueba ni un segundo evento.

    La versión la manda la interfaz con lo que la persona leyó; si los textos cambiaron
    mientras tanto, se rechaza para que nadie acepte sin haber visto la versión vigente.
    """
    if version != LEGAL_VERSION:
        raise LegalVersionMismatchError
    # Bloquea la fila: dos pestañas que aceptan a la vez dejan una sola prueba.
    user = session.scalar(select(User).where(User.id == principal.user_id).with_for_update())
    if user is None:  # authenticate acaba de comprobar que existe y está activa.
        msg = "La persona de la sesión no existe"
        raise LookupError(msg)
    if user.terms_version == LEGAL_VERSION and user.privacy_version == LEGAL_VERSION:
        session.rollback()
        return False

    now = datetime.datetime.now(datetime.UTC)
    user.terms_version = LEGAL_VERSION
    user.privacy_version = LEGAL_VERSION
    user.consented_at = now
    session.add_all(
        [
            LegalAcceptance(
                user_id=user.id,
                email=user.email,
                version=LEGAL_VERSION,
                context="renewal",
                accepted_at=now,
            ),
            # Visible para el propietario en la auditoría de su organización (HU-014).
            AuditLog(
                organization_id=principal.organization_id,
                actor_user_id=user.id,
                action="legal_accepted",
                target_id=user.id,
                ip=audit_ip(client_ip),
                user_agent=audit_user_agent(user_agent),
                created_at=now,
            ),
        ]
    )
    session.commit()
    return True
