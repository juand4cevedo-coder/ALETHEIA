"""Primer cobro de una suscripción con Wompi, por Nequi (HU-027, RF-038).

Solo arranca el cobro: la activación llega por el webhook de Wompi (app.services.payments),
nunca desde aquí. La referencia que se le manda a Wompi lleva codificada la organización, el
plan y el ciclo, así que la activación no necesita guardar nada mientras el pago está pendiente.
"""

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
from app.services.sessions import Principal

_PREFIJO: Final = "aletheia"
_REFERENCIA: Final = re.compile(
    r"^aletheia:(?P<organization_id>[0-9a-f-]{36}):(?P<plan_code>[a-z_]{1,30}):"
    r"(?P<billing_cycle>monthly|annual):(?P<nonce>[0-9a-f-]{36})$"
)
_TELEFONO_COLOMBIA: Final = re.compile(r"^3\d{9}$")


class CheckoutNoPermitidoError(Exception):
    """La persona, el plan o el ciclo no admiten iniciar un cobro."""


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
    if subscription.pending_checkout_reference is not None:
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
    return Cobro(
        transaction_id=transaccion.id, reference=transaccion.reference, status=transaccion.status
    )
