"""Consultas sobre el catálogo de planes (DAT-08)."""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Plan


def list_public_plans(session: Session) -> Sequence[Plan]:
    """Planes visibles en la página de precios, del más económico al más amplio."""
    statement = (
        select(Plan)
        .where(Plan.is_public, Plan.monthly_price_cop.is_not(None))
        .order_by(Plan.monthly_price_cop, Plan.included_users)
    )
    return session.scalars(statement).all()
