"""Fuente de pago vinculada para renovar el plan sin intervención (ADR-058, solo la vinculación).

La persona responsable del despacho vincula su Nequi: ALETHEIA pide el token a Wompi, la persona
aprueba la vinculación en su celular y, con la aprobación, se crea la fuente de pago. Se guarda el
consentimiento exacto (versión del texto, fecha, quién y desde qué IP) y el identificador de la
fuente, nunca datos de pago. Cancelar es inmediato y definitivo: una fuente cancelada no se vuelve
a usar.

Esta etapa solo vincula y cancela. El cobro automático es otra etapa y nace apagado.
"""

import datetime
import re
import uuid
from dataclasses import dataclass
from typing import Final

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters import wompi
from app.core.config import Settings
from app.core.permissions import has_permission
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, PaymentSource
from app.services.audit import audit_ip, audit_user_agent
from app.services.sessions import Principal

CONSENT_VERSION: Final = "2026-11-24"
CONSENT_TEXT: Final = (
    "Autorizo a ALETHEIA a cobrar, al vencer cada periodo, el valor del plan de mi despacho a "
    "mi Nequi, hasta que yo lo cancele. Me avisará por correo siete días antes de cada cobro, y "
    "puedo cancelar cuando quiera desde Plan y facturación."
)
_PHONE: Final = re.compile(r"3\d{9}")


class RecurringUnavailableError(Exception):
    """La renovación automática no está encendida o no está configurada la pasarela."""


class NotAllowedError(Exception):
    pass


class ConsentMismatchError(Exception):
    """La persona aceptó una versión del texto que ya no es la vigente."""


class InvalidPhoneError(Exception):
    pass


class AlreadyLinkedError(Exception):
    pass


class NothingToConfirmError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class SourceView:
    status: str
    phone_last4: str | None
    linked_at: datetime.datetime | None


def _guard(settings: Settings, principal: Principal) -> uuid.UUID:
    if not settings.recurring_payments_enabled:
        raise RecurringUnavailableError
    if principal.organization_id is None or not has_permission(principal.role, "billing.manage"):
        raise NotAllowedError
    return principal.organization_id


def _live(session: Session, organization_id: uuid.UUID) -> PaymentSource | None:
    return session.scalar(
        select(PaymentSource)
        .where(
            PaymentSource.organization_id == organization_id,
            PaymentSource.status.in_(("pending", "active")),
        )
        .with_for_update()
    )


def current(session: Session, settings: Settings, principal: Principal) -> SourceView | None:
    """La fuente en trámite o activa del despacho, o None."""
    organization_id = _guard(settings, principal)
    set_tenant(session, TenantContext(organization_id=organization_id, user_id=principal.user_id))
    source = _live(session, organization_id)
    if source is None:
        return None
    return SourceView(source.status, source.phone_last4, source.linked_at)


def _audit(
    session: Session,
    principal: Principal,
    action: str,
    source: PaymentSource,
    client_ip: str,
    user_agent: str | None,
    now: datetime.datetime,
) -> None:
    session.add(
        AuditLog(
            organization_id=principal.organization_id,
            actor_user_id=principal.user_id,
            action=action,
            target_id=source.id,
            details={"medio": source.kind, "terminacion": source.phone_last4},
            ip=audit_ip(client_ip),
            user_agent=audit_user_agent(user_agent),
            created_at=now,
        )
    )
    session.flush()


def start(
    session: Session,
    settings: Settings,
    principal: Principal,
    *,
    phone_number: str,
    consent_version: str,
    client_ip: str,
    user_agent: str | None,
) -> SourceView:
    """Pide el token de Nequi a Wompi y deja la fuente en trámite hasta que la persona apruebe
    la vinculación en su celular."""
    del user_agent
    organization_id = _guard(settings, principal)
    if consent_version != CONSENT_VERSION:
        raise ConsentMismatchError
    if _PHONE.fullmatch(phone_number) is None:
        raise InvalidPhoneError
    set_tenant(session, TenantContext(organization_id=organization_id, user_id=principal.user_id))
    if _live(session, organization_id) is not None:
        raise AlreadyLinkedError
    creds = wompi.credenciales_de(settings)
    token = wompi.crear_token_nequi(creds, phone_number)
    now = datetime.datetime.now(datetime.UTC)
    source = PaymentSource(
        organization_id=organization_id,
        created_by=principal.user_id,
        kind="nequi",
        status="pending",
        gateway_token=token,
        phone_last4=phone_number[-4:],
        consent_version=consent_version,
        consent_accepted_at=now,
        consent_ip=audit_ip(client_ip),
    )
    session.add(source)
    session.flush()
    return SourceView(source.status, source.phone_last4, None)


def confirm(
    session: Session,
    settings: Settings,
    principal: Principal,
    *,
    acceptance_token: str,
    accept_personal_auth: str,
    client_ip: str,
    user_agent: str | None,
) -> SourceView:
    """Consulta a Wompi si la persona ya aprobó en su celular. Con la aprobación crea la fuente de
    pago; si la rechazó, la deja declinada y libera el cupo para volver a intentar."""
    organization_id = _guard(settings, principal)
    set_tenant(session, TenantContext(organization_id=organization_id, user_id=principal.user_id))
    source = _live(session, organization_id)
    if source is None or source.status != "pending" or source.gateway_token is None:
        raise NothingToConfirmError
    creds = wompi.credenciales_de(settings)
    approval = wompi.consultar_token_nequi(creds, source.gateway_token)
    if approval == "PENDING":
        return SourceView(source.status, source.phone_last4, None)
    now = datetime.datetime.now(datetime.UTC)
    if approval != "APPROVED":
        source.status = "declined"
        session.flush()
        return SourceView("declined", source.phone_last4, None)
    email = _owner_email(session, principal)
    source.gateway_source_id = wompi.crear_fuente_nequi(
        creds,
        token=source.gateway_token,
        customer_email=email,
        acceptance_token=acceptance_token,
        accept_personal_auth=accept_personal_auth,
    )
    source.status = "active"
    source.linked_at = now
    session.flush()
    _schedule_current_period(session, organization_id)
    _audit(session, principal, "payment_source_linked", source, client_ip, user_agent, now)
    return SourceView("active", source.phone_last4, now)


def _schedule_current_period(session: Session, organization_id: uuid.UUID) -> None:
    """Al vincular la fuente, el periodo que ya está pagado se renueva solo al vencer."""
    from app.models import Subscription
    from app.services import renewals

    subscription = session.scalar(
        select(Subscription).where(Subscription.organization_id == organization_id)
    )
    if (
        subscription is not None
        and subscription.status == "active"
        and subscription.access_source == "payment"
        and subscription.current_period_end is not None
    ):
        renewals.schedule(session, organization_id, subscription.current_period_end)


def _owner_email(session: Session, principal: Principal) -> str:
    from app.models import User

    email = session.scalar(select(User.email).where(User.id == principal.user_id))
    if email is None:
        raise NotAllowedError
    return email


def cancel(
    session: Session,
    settings: Settings,
    principal: Principal,
    *,
    client_ip: str,
    user_agent: str | None,
) -> bool:
    """Cancela la fuente en trámite o activa. Devuelve si había algo que cancelar."""
    organization_id = _guard(settings, principal)
    set_tenant(session, TenantContext(organization_id=organization_id, user_id=principal.user_id))
    source = _live(session, organization_id)
    if source is None:
        return False
    now = datetime.datetime.now(datetime.UTC)
    was_active = source.status == "active"
    source.status = "canceled"
    source.canceled_at = now
    source.canceled_by = principal.user_id
    session.flush()
    if was_active:
        _audit(session, principal, "payment_source_canceled", source, client_ip, user_agent, now)
    return True
