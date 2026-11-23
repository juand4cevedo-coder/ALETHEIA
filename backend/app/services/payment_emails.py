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
from app.models import Membership, Organization, Plan, Subscription, User
from app.services import jobs
from app.services.email_layout import email_layout
from app.services.jobs import PermanentJobError
from app.services.notifications import email_template
from app.services.organization_emails import colombian_datetime

APPROVED_TEMPLATE: Final = "payment_approved_receipt"
REMINDER_TEMPLATE: Final = "subscription_renewal_reminder"
REMINDER_DAYS: Final = 7
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


@email_template(APPROVED_TEMPLATE)
def receipt_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    facts = _facts(session, payload)
    if facts is None:
        return None
    user, organization, plan, _, cycle, period_end = facts
    amount = plan.monthly_price_cop if cycle == "monthly" else plan.annual_price_cop
    price = _cop(amount) if amount else "sin costo"
    until = colombian_datetime(period_end)
    name = user.full_name
    cycle_text = _CYCLES.get(cycle, cycle)
    return OutgoingEmail(
        to=user.email,
        subject=f"Recibimos el pago de {organization.name} en ALETHEIA",
        text=(
            f"Hola, {name}:\n\n"
            f"Recibimos el pago del plan {plan.name} ({cycle_text}) de {organization.name}: "
            f"{price}.\n\n"
            f"El plan queda activo hasta el {until} (hora de Colombia). Le avisaremos "
            f"{REMINDER_DAYS} días antes para que lo renueve.\n\n"
            "Este correo es su comprobante. Si algo no coincide, escríbanos a "
            f"{REPLY_TO}.\n\nALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [
                f"Recibimos el pago del plan <strong>{html.escape(plan.name)}</strong> "
                f"({html.escape(cycle_text)}) de {html.escape(organization.name)}: "
                f"<strong>{html.escape(price)}</strong>.",
                f"El plan queda activo hasta el {html.escape(until)} (hora de Colombia). Le "
                f"avisaremos {REMINDER_DAYS} días antes para que lo renueve.",
            ],
            ("Ir a ALETHEIA", settings.public_url),
            "Este correo es su comprobante. Si algo no coincide, escríbanos a "
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
    return OutgoingEmail(
        to=user.email,
        subject=f"El plan de {organization.name} vence pronto",
        text=(
            f"Hola, {name}:\n\n"
            f"El plan {plan.name} de {organization.name} vence el {until} (hora de Colombia). "
            "Si no se renueva, el despacho pasa a solo lectura: podrán consultar sus casos y "
            "descargar sus archivos, pero no abrir casos nuevos ni subir evidencia.\n\n"
            "Para renovarlo, entre a ALETHEIA, a Organización y luego a Suscripción:\n"
            f"{settings.public_url}\n\nALETHEIA"
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
            ("Renovar el plan", settings.public_url),
            "Para renovarlo, entre a Organización y luego a Suscripción.",
            site_url=settings.public_url,
        ),
    )
