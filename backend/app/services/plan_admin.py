"""Edición de los planes del catálogo por la cuenta propietaria de la plataforma.

Cada cambio queda en la auditoría de la plataforma con los valores de antes y de después. Los
precios y los cupos de un plan nunca viven en el código (RN-019): se editan aquí.
"""

import datetime
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog, Plan
from app.schemas.platform import PlanUpdate
from app.services.audit import audit_ip

_FIELDS = (
    "monthly_price_cop",
    "annual_price_cop",
    "included_users",
    "extra_user_price_cop",
    "is_public",
)


class PlanNotFoundError(Exception):
    pass


class PlanChangeInvalidError(Exception):
    """El cambio dejaría el plan en un estado que el catálogo no admite."""


def update(
    session: Session, actor_id: uuid.UUID, code: str, change: PlanUpdate, client_ip: str
) -> Plan:
    plan = session.scalar(select(Plan).where(Plan.code == code).with_for_update())
    if plan is None:
        raise PlanNotFoundError
    before = {field: getattr(plan, field) for field in _FIELDS}
    for field in _FIELDS:
        value = getattr(change, field, None)
        if value is not None:
            setattr(plan, field, value)
    if change.clear_extra_user_price:
        plan.extra_user_price_cop = None
    # Un plan de pago no puede quedar con el mensual en cero, y el anual no puede salir más caro
    # que doce meses: el catálogo público lo mostraría como un descuento al revés.
    if plan.code != "trial" and not (plan.monthly_price_cop or 0) > 0 and plan.is_public:
        raise PlanChangeInvalidError
    if (
        plan.monthly_price_cop is not None
        and plan.annual_price_cop is not None
        and plan.annual_price_cop > plan.monthly_price_cop * 12
    ):
        raise PlanChangeInvalidError
    after = {field: getattr(plan, field) for field in _FIELDS}
    changed = {
        field: {"antes": str(before[field]), "despues": str(after[field])}
        for field in _FIELDS
        if before[field] != after[field]
    }
    if changed:
        session.add(
            AuditLog(
                organization_id=None,
                actor_user_id=actor_id,
                action="plan_updated",
                target_id=plan.id,
                details={
                    "plan": plan.code,
                    **{k: f"{v['antes']} -> {v['despues']}" for k, v in changed.items()},
                },
                ip=audit_ip(client_ip),
                created_at=datetime.datetime.now(datetime.UTC),
            )
        )
    session.flush()
    return plan
