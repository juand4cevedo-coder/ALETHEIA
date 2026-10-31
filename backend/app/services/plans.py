"""Catálogo público de planes: precios y límites tal como están en la base (RN-019)."""

from typing import Final

from sqlalchemy.orm import Session

from app.models import Plan
from app.repositories import plans as plans_repository
from app.schemas.plans import PublicPlan

TRIAL_PLAN_CODE: Final = "trial"
# Duración de la prueba gratuita (RN-017). El registro la usará para fijar trial_ends_at.
TRIAL_DAYS: Final = 14


def _to_public_plan(plan: Plan) -> PublicPlan:
    if plan.monthly_price_cop is None:  # El repositorio solo entrega planes con precio.
        msg = f"El plan {plan.code} no tiene precio mensual"
        raise ValueError(msg)
    return PublicPlan(
        code=plan.code,
        name=plan.name,
        monthly_price_cop=plan.monthly_price_cop,
        annual_price_cop=plan.annual_price_cop,
        included_users=plan.included_users,
        extra_user_price_cop=plan.extra_user_price_cop,
        storage_limit_bytes=plan.storage_limit_bytes,
        max_file_bytes=plan.max_file_bytes,
        trial_days=TRIAL_DAYS if plan.code == TRIAL_PLAN_CODE else None,
    )


def public_catalog(session: Session) -> list[PublicPlan]:
    """Planes de la página de precios. Corporativo se cotiza, así que no figura aquí."""
    return [_to_public_plan(plan) for plan in plans_repository.list_public_plans(session)]
