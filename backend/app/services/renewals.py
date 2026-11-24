"""Renovación automática: cobra el plan a la fuente de pago vinculada (ADR-058, etapa 2).

Un día antes de que venza el periodo pagado, una tarea cobra la renovación a la fuente de pago
que la persona vinculó. El resultado entra por el mismo camino que cualquier pago (el aviso de
Wompi o su consulta firmada), así que la activación, la extensión del periodo y el comprobante no
se duplican. Si el cobro no entra, se reintenta a los tres y seis días del primer intento; si el
tercero tampoco entra, se avisa al responsable y el plan sigue su curso (vence a solo lectura).

Todo está apagado mientras `recurring_payments_enabled` lo esté. Cada intento comprueba de nuevo
que siga valiendo la pena cobrar: la fuente activa, el plan sin renovar, ningún cobro en curso.
"""

import datetime
import uuid
from dataclasses import dataclass
from typing import Final, Literal, cast

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters import wompi
from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import Membership, Organization, PaymentSource, Plan, Subscription, User
from app.services import checkout, jobs, payment_emails, payments

CHARGE_JOB: Final = "renewal_charge"
# Se cobra un día antes de vencer, para que un pago aprobado llegue antes del vencimiento.
LEAD: Final = payment_emails.CHARGE_LEAD
# Si el cobro no entra, el siguiente intento va tres días después del anterior.
RETRY_EVERY: Final = datetime.timedelta(days=3)
MAX_ATTEMPTS: Final = 3
# Si el resultado de un cobro sigue sin conocerse, la reconciliación lo resuelve más tarde.
RECONCILE_AFTER: Final = datetime.timedelta(minutes=20)
_FINAL_FAILURES: Final = frozenset({"DECLINED", "ERROR", "VOIDED"})


@dataclass(frozen=True, slots=True)
class _Charge:
    source_id: int
    amount_in_cents: int
    customer_email: str
    reference: str
    plan_code: str
    billing_cycle: str


def _key(organization_id: uuid.UUID, period_end: datetime.datetime, attempt: int) -> str:
    return f"renewal:{organization_id}:{int(period_end.timestamp())}:{attempt}"


def schedule(
    session: Session,
    organization_id: uuid.UUID,
    period_end: datetime.datetime,
    *,
    attempt: int = 1,
    now: datetime.datetime | None = None,
    after: datetime.timedelta | None = None,
) -> None:
    """Agenda un intento de cobro del periodo que vence en `period_end`. Repetirlo no duplica."""
    now = now or datetime.datetime.now(datetime.UTC)
    run_at = now + after if after is not None else period_end - LEAD
    jobs.enqueue(
        session,
        CHARGE_JOB,
        {
            "organization_id": str(organization_id),
            "period_end": period_end.isoformat(),
            "attempt": attempt,
        },
        _key(organization_id, period_end, attempt),
        delay=max(run_at - now, datetime.timedelta(0)),
    )


def schedule_if_linked(
    session: Session, organization_id: uuid.UUID, period_end: datetime.datetime
) -> None:
    """Agenda el cobro del periodo si el despacho tiene una fuente de pago activa."""
    linked = session.scalar(
        select(PaymentSource.id).where(
            PaymentSource.organization_id == organization_id, PaymentSource.status == "active"
        )
    )
    if linked is not None:
        schedule(session, organization_id, period_end)


def _owner_email(session: Session, organization_id: uuid.UUID, preferred: uuid.UUID) -> str | None:
    email = session.scalar(select(User.email).where(User.id == preferred, User.status == "active"))
    if email is not None:
        return email
    return session.scalar(
        select(User.email)
        .join(Membership, Membership.user_id == User.id)
        .where(
            Membership.organization_id == organization_id,
            Membership.role == "owner",
            User.status == "active",
        )
        .limit(1)
    )


def _prepare(
    session: Session,
    settings: Settings,
    organization_id: uuid.UUID,
    period_end: datetime.datetime,
    now: datetime.datetime,
) -> _Charge | None:
    """Decide si hay que cobrar y deja el cobro pendiente. None si no vale la pena cobrar."""
    set_tenant(session, TenantContext(organization_id=organization_id))
    organization = session.scalar(
        select(Organization).where(Organization.id == organization_id).with_for_update()
    )
    subscription = session.scalar(
        select(Subscription)
        .where(Subscription.organization_id == organization_id)
        .with_for_update()
    )
    if organization is None or organization.status == "closed" or subscription is None:
        return None
    if (
        subscription.access_source != "payment"
        or subscription.billing_cycle not in ("monthly", "annual")
        or subscription.current_period_end != period_end
        or subscription.status not in ("active", "expired")
    ):
        return None  # ya se renovó, cambió de plan o ya no es un plan de pago
    source = session.scalar(
        select(PaymentSource)
        .where(PaymentSource.organization_id == organization_id, PaymentSource.status == "active")
        .with_for_update()
    )
    if source is None or source.gateway_source_id is None:
        return None
    if checkout._pendiente_vigente(subscription.pending_checkout_reference, now):
        return None  # hay un cobro en curso: no se cobra dos veces
    plan = session.get(Plan, subscription.plan_id)
    if plan is None:
        return None
    amount = (
        plan.monthly_price_cop if subscription.billing_cycle == "monthly" else plan.annual_price_cop
    )
    if amount is None or amount <= 0:
        return None
    email = _owner_email(session, organization_id, source.created_by)
    if email is None:
        return None
    cycle = cast(Literal["monthly", "annual"], subscription.billing_cycle)
    reference = checkout.referencia_nueva(organization_id, plan.code, cycle)
    subscription.pending_checkout_reference = reference
    return _Charge(
        source_id=source.gateway_source_id,
        amount_in_cents=amount * 100,
        customer_email=email,
        reference=reference,
        plan_code=plan.code,
        billing_cycle=cycle,
    )


def attempt(
    session: Session,
    settings: Settings,
    organization_id: uuid.UUID,
    period_end: datetime.datetime,
    number: int,
) -> str:
    """Un intento de cobro. Devuelve qué pasó: `skipped`, `approved`, `pending`, `failed` o
    `gave_up`. Confirma la transacción antes de hablar con Wompi, para que el cobro pendiente
    quede firme aunque el proceso se caiga a mitad (ADR-038)."""
    if not settings.recurring_payments_enabled:
        return "skipped"
    now = datetime.datetime.now(datetime.UTC)
    charge = _prepare(session, settings, organization_id, period_end, now)
    session.commit()
    if charge is None:
        return "skipped"
    creds = wompi.credenciales_de(settings)
    try:
        transaction = wompi.cobrar_con_fuente(
            creds,
            source_id=charge.source_id,
            amount_in_cents=charge.amount_in_cents,
            reference=charge.reference,
            customer_email=charge.customer_email,
        )
    except wompi.WompiRechazadoError:
        return _failed(session, organization_id, period_end, number, now)
    set_tenant(session, TenantContext(organization_id=organization_id))
    if transaction.status in _FINAL_FAILURES:
        payments.aplicar_consultada(session, transaction)
        session.commit()
        return _failed(session, organization_id, period_end, number, now)
    if transaction.status == "APPROVED":
        payments.aplicar_consultada(session, transaction)
        session.commit()
        return "approved"
    # El cobro sigue en trámite: el aviso de Wompi lo resuelve, y la reconciliación lo comprueba
    # más tarde si ese aviso no llega. Mientras tanto, queda agendado el siguiente intento.
    jobs.enqueue(
        session,
        "payment_reconcile",
        {"transaction_id": transaction.id},
        f"payment_reconcile:{transaction.id}:renewal",
        delay=RECONCILE_AFTER,
    )
    schedule(session, organization_id, period_end, attempt=number + 1, after=RETRY_EVERY, now=now)
    session.commit()
    return "pending"


def _failed(
    session: Session,
    organization_id: uuid.UUID,
    period_end: datetime.datetime,
    number: int,
    now: datetime.datetime,
) -> str:
    """El cobro no entró: se agenda el siguiente intento, o se avisa si ya no quedan."""
    set_tenant(session, TenantContext(organization_id=organization_id))
    if number < MAX_ATTEMPTS:
        schedule(
            session, organization_id, period_end, attempt=number + 1, after=RETRY_EVERY, now=now
        )
        session.commit()
        return "failed"
    payment_emails.schedule_renewal_failed(session, organization_id, period_end)
    session.commit()
    return "gave_up"
