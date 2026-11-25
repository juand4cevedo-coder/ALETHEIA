"""Comprobantes de pago de ALETHEIA.

Cada pago aprobado deja un comprobante numerado en orden (CP-2026-000001), con el plan, el
periodo cubierto, el valor y el medio de pago. Mientras el operador no esté obligado a expedir
factura electrónica, es el documento que se entrega por cada cobro. Un comprobante emitido no se
edita: solo se agrega, y el mismo pago nunca emite dos.
"""

import datetime
import uuid
from dataclasses import dataclass
from typing import Final
from zoneinfo import ZoneInfo

from sqlalchemy import extract, func, select, text
from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import Membership, PaymentReceipt, User
from app.services.sessions import Principal

_BOGOTA = ZoneInfo("America/Bogota")

CYCLES: Final = {"monthly": "Mensual", "annual": "Anual"}
METHODS: Final = {
    "CARD": "Tarjeta",
    "PSE": "PSE",
    "NEQUI": "Nequi",
    "BANCOLOMBIA_TRANSFER": "Transferencia Bancolombia",
    "BANCOLOMBIA_COLLECT": "Bancolombia",
    "DAVIPLATA": "Daviplata",
    "PCOL": "Puntos Colombia",
}

NOT_AN_INVOICE: Final = (
    "Este documento es el comprobante de pago de ALETHEIA. No es una factura electrónica: el "
    "vendedor es una persona natural no responsable de IVA y, por ahora, no está obligado a "
    "expedir factura electrónica."
)


def cop(amount: int) -> str:
    return "$" + f"{amount:,}".replace(",", ".") + " COP"


def method_label(method: str | None) -> str:
    if not method:
        return "No informado"
    return METHODS.get(method.upper(), method.title())


def issue(
    session: Session,
    *,
    organization_id: uuid.UUID,
    organization_name: str,
    payment_event_id: uuid.UUID,
    transaction_id: str,
    payment_method: str | None,
    amount_cop: int,
    plan_name: str,
    billing_cycle: str,
    period_start: datetime.datetime,
    period_end: datetime.datetime,
    issued_at: datetime.datetime,
) -> PaymentReceipt | None:
    """Emite el comprobante del pago, o devuelve None si ese pago ya tiene uno."""
    existing = session.scalar(
        select(PaymentReceipt).where(PaymentReceipt.payment_event_id == payment_event_id)
    )
    if existing is not None:
        return None
    owner = session.execute(
        select(User.email)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.organization_id == organization_id, Membership.role == "owner")
        .limit(1)
    ).scalar_one_or_none()
    sequence = session.execute(text("SELECT nextval('payment_receipt_seq')")).scalar_one()
    receipt = PaymentReceipt(
        organization_id=organization_id,
        payment_event_id=payment_event_id,
        number=f"CP-{issued_at.astimezone(_BOGOTA).year}-{int(sequence):06d}",
        gateway_transaction_id=transaction_id[:100],
        payment_method=payment_method,
        amount_cop=amount_cop,
        plan_name=plan_name,
        billing_cycle=billing_cycle,
        period_start=period_start,
        period_end=period_end,
        buyer_name=organization_name,
        buyer_email=owner,
        issued_at=issued_at,
    )
    session.add(receipt)
    session.flush()
    return receipt


def list_for(session: Session, principal: Principal, *, limit: int = 100) -> list[PaymentReceipt]:
    """Los comprobantes del despacho, del más reciente al más antiguo."""
    if principal.organization_id is None:
        return []
    set_tenant(
        session, TenantContext(organization_id=principal.organization_id, user_id=principal.user_id)
    )
    return list(
        session.scalars(
            select(PaymentReceipt)
            .where(PaymentReceipt.organization_id == principal.organization_id)
            .order_by(PaymentReceipt.issued_at.desc(), PaymentReceipt.number.desc())
            .limit(limit)
        )
    )


def get_for(session: Session, principal: Principal, receipt_id: uuid.UUID) -> PaymentReceipt | None:
    if principal.organization_id is None:
        return None
    set_tenant(
        session, TenantContext(organization_id=principal.organization_id, user_id=principal.user_id)
    )
    return session.scalar(
        select(PaymentReceipt).where(
            PaymentReceipt.id == receipt_id,
            PaymentReceipt.organization_id == principal.organization_id,
        )
    )


@dataclass(frozen=True, slots=True)
class YearCollected:
    year: int
    receipts: int
    collected_cop: int


def collected_in(session: Session, year: int) -> YearCollected:
    """Lo cobrado en un año, en hora de Colombia, sumando los comprobantes. Solo lo ve la
    plataforma: la política de lectura lo restringe a la cuenta propietaria."""
    local = func.timezone("America/Bogota", PaymentReceipt.issued_at)
    row = session.execute(
        select(func.count(), func.coalesce(func.sum(PaymentReceipt.amount_cop), 0)).where(
            extract("year", local) == year
        )
    ).one()
    return YearCollected(year=year, receipts=int(row[0]), collected_cop=int(row[1]))
