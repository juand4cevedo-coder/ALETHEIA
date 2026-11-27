"""Correos de pagos: el comprobante al aprobarse un cobro y el aviso antes de que venza el plan.

Los dos van a quienes son responsables del despacho. No llevan datos de tarjeta ni de Nequi,
solo el plan, el monto y las fechas. El aviso de renovación se programa al aprobarse el pago y
se vuelve a comprobar al enviarlo: si el plan ya se renovó o se canceló, no sale.
"""

import datetime
import html
import uuid
from typing import Any, Final

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters.email import REPLY_TO, OutgoingEmail
from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import (
    Membership,
    Organization,
    PaymentReceipt,
    PaymentSource,
    Plan,
    Subscription,
    User,
)
from app.services import jobs, pricing
from app.services.email_layout import email_layout
from app.services.jobs import PermanentJobError
from app.services.notifications import email_template
from app.services.organization_emails import colombian_datetime

APPROVED_TEMPLATE: Final = "payment_approved_receipt"
REMINDER_TEMPLATE: Final = "subscription_renewal_reminder"
REMINDER_DAYS: Final = 7
FAILED_TEMPLATE: Final = "renewal_failed"
# La renovación automática cobra un día antes de vencer el periodo.
CHARGE_LEAD: Final = datetime.timedelta(days=1)
_CYCLES: Final = {"monthly": "mensual", "annual": "anual"}


def _cop(amount: int) -> str:
    return "$" + f"{amount:,}".replace(",", ".") + " COP"


def schedule_for_owners(
    session: Session,
    organization_id: uuid.UUID,
    *,
    plan_code: str,
    cycle: str,
    period_end: datetime.datetime,
    event_id: uuid.UUID,
) -> None:
    """Encola el comprobante ahora y el aviso de renovación, siete días antes de vencer."""
    owners = session.scalars(
        select(Membership.user_id).where(
            Membership.organization_id == organization_id, Membership.role == "owner"
        )
    ).all()
    now = datetime.datetime.now(datetime.UTC)
    remind_in = period_end - datetime.timedelta(days=REMINDER_DAYS) - now
    for user_id in owners:
        base = {
            "organization_id": str(organization_id),
            "user_id": str(user_id),
            "plan_code": plan_code,
            "cycle": cycle,
            "period_end": period_end.isoformat(),
            "event_id": str(event_id),
        }
        jobs.enqueue(
            session,
            "email_send",
            {"template": APPROVED_TEMPLATE, **base},
            f"{APPROVED_TEMPLATE}:{event_id}:{user_id}",
        )
        if remind_in > datetime.timedelta(0):
            jobs.enqueue(
                session,
                "email_send",
                {"template": REMINDER_TEMPLATE, **base},
                f"{REMINDER_TEMPLATE}:{organization_id}:{period_end.date()}:{user_id}",
                delay=remind_in,
            )


def _facts(
    session: Session, payload: dict[str, Any]
) -> tuple[User, Organization, Plan, Subscription, str, datetime.datetime] | None:
    try:
        organization_id = uuid.UUID(str(payload["organization_id"]))
        user_id = uuid.UUID(str(payload["user_id"]))
        plan_code = str(payload["plan_code"])
        cycle = str(payload["cycle"])
        period_end = datetime.datetime.fromisoformat(str(payload["period_end"]))
    except KeyError, ValueError:
        msg = "La tarea de correo de pagos no trae datos válidos."
        raise PermanentJobError(msg) from None
    set_tenant(session, TenantContext(organization_id=organization_id))
    user = session.get(User, user_id)
    organization = session.get(Organization, organization_id)
    plan = session.scalar(select(Plan).where(Plan.code == plan_code))
    subscription = session.scalar(
        select(Subscription).where(Subscription.organization_id == organization_id)
    )
    if (
        user is None
        or user.status != "active"
        or organization is None
        or plan is None
        or subscription is None
    ):
        return None
    return user, organization, plan, subscription, cycle, period_end


def _receipt(session: Session, payload: dict[str, Any]) -> PaymentReceipt | None:
    try:
        event_id = uuid.UUID(str(payload["event_id"]))
    except KeyError, ValueError:
        return None
    return session.scalar(select(PaymentReceipt).where(PaymentReceipt.payment_event_id == event_id))


def extra_users_line(extra_users: int, extra_users_cop: int, cycle: str) -> str | None:
    """La línea de los usuarios adicionales, o None si el pago no los tuvo."""
    if extra_users <= 0:
        return None
    people = "usuario adicional" if extra_users == 1 else "usuarios adicionales"
    unit = extra_users_cop // extra_users
    period = "al mes" if cycle == "monthly" else "al año"
    return f"{extra_users} {people} a {_cop(unit)} {period} cada uno, {_cop(extra_users_cop)}"


@email_template(APPROVED_TEMPLATE)
def receipt_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    facts = _facts(session, payload)
    if facts is None:
        return None
    user, organization, plan, _, cycle, period_end = facts
    receipt = _receipt(session, payload)
    number = receipt.number if receipt is not None else None
    if receipt is not None:
        amount: int | None = receipt.amount_cop
        extra = extra_users_line(receipt.extra_users, receipt.extra_users_cop, cycle)
        plan_amount = receipt.amount_cop - receipt.extra_users_cop
    else:
        amount = plan.monthly_price_cop if cycle == "monthly" else plan.annual_price_cop
        extra = None
        plan_amount = amount or 0
    price = _cop(amount) if amount else "sin costo"
    where = f"{settings.public_url}/app/facturacion"
    until = colombian_datetime(period_end)
    name = user.full_name
    cycle_text = _CYCLES.get(cycle, cycle)
    # Con usuarios adicionales, el detalle va aparte: el plan y las personas de más.
    detail = f"Detalle: plan {plan.name}, {_cop(plan_amount)}, y {extra}." if extra else None
    return OutgoingEmail(
        to=user.email,
        subject=f"Recibimos el pago de {organization.name} en ALETHEIA",
        text=(
            f"Hola, {name}:\n\n"
            f"Recibimos el pago del plan {plan.name} ({cycle_text}) de {organization.name}: "
            f"{price}.\n\n"
            + (f"{detail}\n\n" if detail else "")
            + f"El plan queda activo hasta el {until} (hora de Colombia). Le avisaremos "
            f"{REMINDER_DAYS} días antes para que lo renueve.\n\n"
            + (
                f"Comprobante de pago N.º {number}. Descargue el PDF en {where}.\n\n"
                if number
                else ""
            )
            + "Si algo no coincide, escríbanos a "
            f"{REPLY_TO}.\n\nALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [
                f"Recibimos el pago del plan <strong>{html.escape(plan.name)}</strong> "
                f"({html.escape(cycle_text)}) de {html.escape(organization.name)}: "
                f"<strong>{html.escape(price)}</strong>.",
                *([html.escape(detail)] if detail else []),
                f"El plan queda activo hasta el {html.escape(until)} (hora de Colombia). Le "
                f"avisaremos {REMINDER_DAYS} días antes para que lo renueve.",
            ],
            (
                "Descargar el comprobante" if number else "Ir a ALETHEIA",
                where if number else settings.public_url,
            ),
            (f"Comprobante de pago N.º {html.escape(number)}. " if number else "")
            + "Si algo no coincide, escríbanos a "
            f"{html.escape(REPLY_TO)}.",
            site_url=settings.public_url,
        ),
    )


@email_template(REMINDER_TEMPLATE)
def reminder_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    facts = _facts(session, payload)
    if facts is None:
        return None
    user, organization, plan, subscription, _, period_end = facts
    # Si el plan ya se renovó (otra fecha de vencimiento) o dejó de estar activo, no hay nada
    # que recordar.
    current = subscription.current_period_end
    if (
        subscription.status != "active"
        or current is None
        or abs((current - period_end).total_seconds()) > 1
    ):
        return None
    until = colombian_datetime(period_end)
    name = user.full_name
    last4 = _linked_last4(session, organization.id)
    if last4 is not None:
        return _automatic_reminder(
            organization,
            plan,
            subscription,
            user,
            until,
            last4,
            period_end,
            settings,
            users=pricing.users_counted(
                session, organization.id, datetime.datetime.now(datetime.UTC)
            ),
        )
    where = f"{settings.public_url}/app/facturacion"
    return OutgoingEmail(
        to=user.email,
        subject=f"El plan de {organization.name} vence pronto",
        text=(
            f"Hola, {name}:\n\n"
            f"El plan {plan.name} de {organization.name} vence el {until} (hora de Colombia). "
            "Si no se renueva, el despacho pasa a solo lectura: podrán consultar sus casos y "
            "descargar sus archivos, pero no abrir casos nuevos ni subir evidencia.\n\n"
            f"Para renovarlo, entre a Plan y facturación: {where}\n\nALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [
                f"El plan <strong>{html.escape(plan.name)}</strong> de "
                f"{html.escape(organization.name)} vence el {html.escape(until)} (hora de "
                "Colombia).",
                "Si no se renueva, el despacho pasa a solo lectura: podrán consultar sus casos "
                "y descargar sus archivos, pero no abrir casos nuevos ni subir evidencia.",
            ],
            ("Renovar el plan", where),
            "Para renovarlo, entre a Plan y facturación.",
            site_url=settings.public_url,
        ),
    )


def _linked_last4(session: Session, organization_id: uuid.UUID) -> str | None:
    """Los últimos cuatro dígitos del Nequi vinculado, si el despacho renueva automáticamente."""
    return session.scalar(
        select(PaymentSource.phone_last4).where(
            PaymentSource.organization_id == organization_id, PaymentSource.status == "active"
        )
    )


def _automatic_reminder(
    organization: Organization,
    plan: Plan,
    subscription: Subscription,
    user: User,
    until: str,
    last4: str,
    period_end: datetime.datetime,
    settings: Settings,
    *,
    users: int,
) -> OutgoingEmail:
    """El aviso previo de la renovación automática: cuándo se cobra, cuánto y cómo cancelar."""
    # Lo mismo que cobrará la renovación: el plan y las personas de hoy por encima de las incluidas.
    cycle: pricing.Cycle = "annual" if subscription.billing_cycle == "annual" else "monthly"
    quote = pricing.quote(plan, cycle, pricing.extra_users_for(plan, users, enforce_cap=False) or 0)
    price = _cop(quote.total_cop) if quote else "el valor del plan"
    charge_day = colombian_datetime(period_end - CHARGE_LEAD)
    where = f"{settings.public_url}/app/facturacion"
    name = user.full_name
    return OutgoingEmail(
        to=user.email,
        subject=f"Renovaremos el plan de {organization.name} a su Nequi",
        text=(
            f"Hola, {name}:\n\n"
            f"El plan {plan.name} de {organization.name} vence el {until} (hora de Colombia). "
            f"Como activó la renovación automática, cobraremos {price} a su Nequi que termina "
            f"en {last4} hacia el {charge_day}.\n\n"
            "Si prefiere no renovar, cancele la renovación automática antes de esa fecha, en Plan "
            f"y facturación: {where}\n\nALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [
                f"El plan <strong>{html.escape(plan.name)}</strong> de "
                f"{html.escape(organization.name)} vence el {html.escape(until)} (hora de "
                "Colombia).",
                f"Como activó la renovación automática, cobraremos <strong>{html.escape(price)}"
                f"</strong> a su Nequi que termina en {html.escape(last4)} hacia el "
                f"{html.escape(charge_day)}.",
            ],
            ("Cancelar la renovación automática", where),
            "Si prefiere no renovar, cancélela antes de esa fecha en Plan y facturación.",
            site_url=settings.public_url,
        ),
    )


def schedule_renewal_failed(
    session: Session, organization_id: uuid.UUID, period_end: datetime.datetime
) -> None:
    """Avisa a quien administra el despacho que la renovación automática no entró."""
    subscription = session.scalar(
        select(Subscription).where(Subscription.organization_id == organization_id)
    )
    plan = session.get(Plan, subscription.plan_id) if subscription is not None else None
    if subscription is None or plan is None:
        return
    owners = session.scalars(
        select(Membership.user_id).where(
            Membership.organization_id == organization_id, Membership.role == "owner"
        )
    ).all()
    for user_id in owners:
        jobs.enqueue(
            session,
            "email_send",
            {
                "template": FAILED_TEMPLATE,
                "organization_id": str(organization_id),
                "user_id": str(user_id),
                "plan_code": plan.code,
                "cycle": subscription.billing_cycle,
                "period_end": period_end.isoformat(),
            },
            f"{FAILED_TEMPLATE}:{organization_id}:{int(period_end.timestamp())}:{user_id}",
        )


@email_template(FAILED_TEMPLATE)
def renewal_failed_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    facts = _facts(session, payload)
    if facts is None:
        return None
    user, organization, plan, subscription, _, period_end = facts
    current = subscription.current_period_end
    # Si entre tanto el plan se renovó (a mano o por un cobro tardío), no hay nada que avisar.
    if current is None or abs((current - period_end).total_seconds()) > 1:
        return None
    where = f"{settings.public_url}/app/facturacion"
    name = user.full_name
    until = colombian_datetime(period_end)
    return OutgoingEmail(
        to=user.email,
        subject=f"No pudimos renovar el plan de {organization.name}",
        text=(
            f"Hola, {name}:\n\n"
            f"No pudimos cobrar la renovación del plan {plan.name} de {organization.name} a su "
            "Nequi después de varios intentos. Revise que tenga saldo y que la fuente de pago "
            "siga vinculada.\n\n"
            f"El plan vence el {until} (hora de Colombia). Puede renovarlo ahora mismo en Plan y "
            f"facturación: {where}\n\nALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [
                "No pudimos cobrar la renovación del plan "
                f"<strong>{html.escape(plan.name)}</strong> de {html.escape(organization.name)} "
                "a su Nequi después de varios intentos. Revise que tenga saldo y que la fuente "
                "de pago siga vinculada.",
                f"El plan vence el {html.escape(until)} (hora de Colombia).",
            ],
            ("Renovar el plan", where),
            "Puede renovarlo ahora mismo en Plan y facturación.",
            site_url=settings.public_url,
        ),
    )
