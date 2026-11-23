"""Primer cobro de una suscripción con Wompi, por Nequi (HU-027, RF-038).

Solo arranca el cobro: la activación llega por el webhook de Wompi (app.services.payments),
nunca desde aquí. La referencia que se le manda a Wompi lleva codificada la organización, el
plan y el ciclo, así que la activación no necesita guardar nada mientras el pago está pendiente.
"""

import datetime
import re
import uuid
from dataclasses import dataclass
from typing import Final, Literal, cast

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters import wompi
from app.core.config import Settings
from app.core.permissions import has_permission
from app.db.tenancy import TenantContext, set_tenant
from app.models import Organization, Plan, Subscription, User
from app.services import jobs
from app.services.sessions import Principal

# Cuánto se le da a la notificación push de Nequi y al webhook de Wompi antes de ir a
# preguntar directamente (EVT-007): ni tan corto que se adelante al pago normal, ni tan largo
# que una persona se quede esperando sin necesidad si el webhook de verdad se perdió.
_ESPERA_RECONCILIACION: Final = datetime.timedelta(minutes=15)

_PREFIJO: Final = "aletheia"
_REFERENCIA: Final = re.compile(
    r"^aletheia:(?P<organization_id>[0-9a-f-]{36}):(?P<plan_code>[a-z_]{1,30}):"
    r"(?P<billing_cycle>monthly|annual):(?P<nonce>[0-9a-f-]{36})$"
)
_TELEFONO_COLOMBIA: Final = re.compile(r"^3\d{9}$")


# Cuánto vale una dirección del Checkout Web. Pasado ese tiempo Wompi ya no deja pagar con ella,
# y un cobro que nunca llegó a pagarse deja de bloquear uno nuevo.
VIGENCIA_CHECKOUT_WEB: Final = datetime.timedelta(hours=1)
_MARGEN_PENDIENTE: Final = datetime.timedelta(minutes=5)


class CheckoutNoPermitidoError(Exception):
    """La persona, el plan o el ciclo no admiten iniciar un cobro."""


class TransaccionAjenaError(Exception):
    """La transacción no pertenece a la organización de quien la consulta."""


@dataclass(frozen=True, slots=True)
class Cobro:
    transaction_id: str
    reference: str
    status: str


@dataclass(frozen=True, slots=True)
class Referencia:
    organization_id: uuid.UUID
    plan_code: str
    billing_cycle: Literal["monthly", "annual"]


def referencia_nueva(
    organization_id: uuid.UUID, plan_code: str, billing_cycle: Literal["monthly", "annual"]
) -> str:
    return f"{_PREFIJO}:{organization_id}:{plan_code}:{billing_cycle}:{uuid.uuid7()}"


def leer_referencia(reference: str) -> Referencia | None:
    """None si la referencia no es una de las que este servicio generó (de otra integración,
    o manipulada): el llamante la ignora en vez de usarla a medias."""
    coincide = _REFERENCIA.match(reference)
    if coincide is None:
        return None
    # El patrón solo acepta "monthly" o "annual" en ese grupo; cast documenta esa garantía.
    ciclo = cast(Literal["monthly", "annual"], coincide["billing_cycle"])
    return Referencia(
        organization_id=uuid.UUID(coincide["organization_id"]),
        plan_code=coincide["plan_code"],
        billing_cycle=ciclo,
    )


def _pendiente_vigente(reference: str | None, ahora: datetime.datetime) -> bool:
    """Si hay un cobro esperando: ya empezó y todavía puede pagarse. La referencia lleva un UUID v7
    cuyo prefijo es la hora de creación, así que se sabe cuánto lleva sin guardar nada más."""
    if reference is None:
        return False
    coincide = _REFERENCIA.match(reference)
    if coincide is None:
        return True  # una referencia que no entendemos nunca se da por vencida
    nonce = uuid.UUID(coincide["nonce"])
    creada = datetime.datetime.fromtimestamp(
        int.from_bytes(nonce.bytes[:6], "big") / 1000, datetime.UTC
    )
    return ahora - creada < VIGENCIA_CHECKOUT_WEB + _MARGEN_PENDIENTE


def iniciar_checkout_web(
    session: Session,
    settings: Settings,
    principal: Principal,
    plan_code: str,
    billing_cycle: Literal["monthly", "annual"],
) -> str:
    """Arranca un cobro en el Checkout Web de Wompi y devuelve la dirección a la que enviar a la
    persona. No manda nada a Wompi: la transacción nace cuando la persona paga allá, y llega por
    webhook o por confirmar su regreso (`confirmar_regreso`)."""
    organization_id = principal.organization_id
    if organization_id is None or not has_permission(principal.role, "billing.manage"):
        raise CheckoutNoPermitidoError
    set_tenant(session, TenantContext(organization_id=organization_id, user_id=principal.user_id))
    organization = session.get(Organization, organization_id)
    plan = session.scalar(select(Plan).where(Plan.code == plan_code, Plan.is_public.is_(True)))
    user = session.get(User, principal.user_id)
    if organization is None or plan is None or user is None:
        raise CheckoutNoPermitidoError
    amount_cop = plan.monthly_price_cop if billing_cycle == "monthly" else plan.annual_price_cop
    if amount_cop is None or amount_cop <= 0:
        raise CheckoutNoPermitidoError
    subscription = session.scalar(
        select(Subscription)
        .where(Subscription.organization_id == organization_id)
        .with_for_update()
    )
    if subscription is None:
        raise CheckoutNoPermitidoError
    if subscription.status == "active" and subscription.billing_cycle != "none":
        raise CheckoutNoPermitidoError
    ahora = datetime.datetime.now(datetime.UTC)
    if _pendiente_vigente(subscription.pending_checkout_reference, ahora):
        raise CheckoutNoPermitidoError

    reference = referencia_nueva(organization_id, plan_code, billing_cycle)
    subscription.pending_checkout_reference = reference
    creds = wompi.credenciales_de(settings)
    url, _ = wompi.url_de_checkout_web(
        creds,
        reference=reference,
        amount_in_cents=amount_cop * 100,
        redirect_url=f"{settings.public_url}/app/cuenta",
        customer_email=user.email,
        vigencia=VIGENCIA_CHECKOUT_WEB,
        ahora=ahora,
    )
    return url


def confirmar_regreso(session: Session, settings: Settings, principal: Principal) -> str:
    """Al volver del Checkout Web se consulta a Wompi, con la llave privada, el cobro pendiente del
    despacho (la dirección de regreso solo informa y no aporta ningún dato). La referencia sale de
    la base, no de la petición. Si ya terminó, se aplica por el mismo camino que un webhook.
    Devuelve el estado que Wompi reporta."""
    from app.services import payments

    organization_id = principal.organization_id
    if organization_id is None or not has_permission(principal.role, "billing.manage"):
        raise CheckoutNoPermitidoError
    set_tenant(session, TenantContext(organization_id=organization_id, user_id=principal.user_id))
    subscription = session.scalar(
        select(Subscription).where(Subscription.organization_id == organization_id)
    )
    if subscription is None:
        raise CheckoutNoPermitidoError
    reference = subscription.pending_checkout_reference
    if reference is None:
        # Ya se aplicó (un webhook o una confirmación anterior): se dice lo que quedó.
        if subscription.status == "active" and subscription.access_source == "payment":
            return "APPROVED"
        raise TransaccionAjenaError
    creds = wompi.credenciales_de(settings)
    transaccion = wompi.consultar_por_referencia(creds, reference)
    if transaccion is None:
        return "PENDING"  # la persona volvió sin terminar de pagar
    payments.aplicar_consultada(session, transaccion)
    return transaccion.status


def iniciar(
    session: Session,
    settings: Settings,
    principal: Principal,
    plan_code: str,
    billing_cycle: Literal["monthly", "annual"],
    phone_number: str,
    acceptance_token: str,
    accept_personal_auth: str,
) -> Cobro:
    """acceptance_token y accept_personal_auth son los que la persona aceptó de verdad: los
    entregó antes GET /billing/wompi-terms, y quien llama los manda tal cual, para que nunca
    se cobre con una aceptación que la persona nunca vio (RN-022)."""
    organization_id = principal.organization_id
    if organization_id is None or not has_permission(principal.role, "billing.manage"):
        raise CheckoutNoPermitidoError
    if not _TELEFONO_COLOMBIA.match(phone_number):
        raise CheckoutNoPermitidoError
    set_tenant(session, TenantContext(organization_id=organization_id, user_id=principal.user_id))
    organization = session.get(Organization, organization_id)
    plan = session.scalar(select(Plan).where(Plan.code == plan_code, Plan.is_public.is_(True)))
    user = session.get(User, principal.user_id)
    if organization is None or plan is None or user is None:
        raise CheckoutNoPermitidoError
    amount_cop = plan.monthly_price_cop if billing_cycle == "monthly" else plan.annual_price_cop
    if amount_cop is None or amount_cop <= 0:
        raise CheckoutNoPermitidoError
    # Bloqueada, para que dos peticiones a la vez no pasen las dos el siguiente chequeo.
    subscription = session.scalar(
        select(Subscription)
        .where(Subscription.organization_id == organization_id)
        .with_for_update()
    )
    if subscription is None:
        raise CheckoutNoPermitidoError
    # Una suscripción activa por pago no se vuelve a cobrar desde aquí: HU-029 cambia de plan.
    if subscription.status == "active" and subscription.billing_cycle != "none":
        raise CheckoutNoPermitidoError
    # Un cobro de esta misma suscripción ya está esperando la respuesta de Wompi: ni un
    # reintento del usuario ni dos pestañas a la vez generan una segunda transacción.
    if _pendiente_vigente(
        subscription.pending_checkout_reference, datetime.datetime.now(datetime.UTC)
    ):
        raise CheckoutNoPermitidoError

    reference = referencia_nueva(organization_id, plan_code, billing_cycle)
    subscription.pending_checkout_reference = reference

    creds = wompi.credenciales_de(settings)
    transaccion = wompi.crear_transaccion_nequi(
        creds,
        reference=reference,
        amount_in_cents=amount_cop * 100,
        customer_email=user.email,
        phone_number=phone_number,
        acceptance_token=acceptance_token,
        accept_personal_auth=accept_personal_auth,
    )
    # Red de seguridad si el webhook de Wompi nunca llega (EVT-007): sin esto, un cobro
    # aprobado de verdad podría dejar a alguien para siempre con pending_checkout_reference
    # puesto y la suscripción sin activar.
    jobs.enqueue(
        session,
        "payment_reconcile",
        {"transaction_id": transaccion.id},
        f"payment_reconcile:{transaccion.id}",
        delay=_ESPERA_RECONCILIACION,
    )
    return Cobro(
        transaction_id=transaccion.id, reference=transaccion.reference, status=transaccion.status
    )
