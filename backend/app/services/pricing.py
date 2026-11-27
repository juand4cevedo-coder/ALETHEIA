"""Cuánto vale un periodo del plan: el precio del plan más los usuarios adicionales.

Cuenta como usuario cada miembro del despacho que ocupa cupo y cada invitación
abierta, igual que el cupo del equipo (services/members.py, Seats.used): una invitación
reserva un puesto hasta que se acepta, se revoca o vence. Los planes que admiten usuarios
adicionales cobran cada persona por encima de las incluidas a su precio mensual; en el pago
anual, cada una vale diez meses, como el plan.
"""

import datetime
import uuid
from dataclasses import dataclass
from typing import Final, Literal

from sqlalchemy.orm import Session

from app.models import Plan
from app.repositories import organization as organization_repository

Cycle = Literal["monthly", "annual"]

# El pago anual cobra diez meses: el plan y cada usuario adicional.
ANNUAL_MONTHS: Final = 10


@dataclass(frozen=True, slots=True)
class Quote:
    """El valor de un periodo, separado en el plan y los usuarios adicionales."""

    plan_cop: int
    included_users: int
    extra_users: int
    # Lo que vale cada usuario adicional en este ciclo (mensual o anual).
    extra_user_unit_cop: int
    extra_users_cop: int

    @property
    def total_cop(self) -> int:
        return self.plan_cop + self.extra_users_cop


def plan_price(plan: Plan, cycle: Cycle) -> int | None:
    """El precio del plan en ese ciclo, o None si el plan no se vende así."""
    price = plan.monthly_price_cop if cycle == "monthly" else plan.annual_price_cop
    return price if price is not None and price > 0 else None


def extra_user_unit(plan: Plan, cycle: Cycle) -> int | None:
    """Lo que vale un usuario adicional en ese ciclo, o None si el plan no los admite."""
    monthly = plan.extra_user_price_cop
    if monthly is None:
        return None
    return monthly if cycle == "monthly" else monthly * ANNUAL_MONTHS


def extra_users_for(plan: Plan, users: int) -> int | None:
    """Cuántos usuarios pasan de los incluidos. None si sobran y el plan no admite adicionales:
    ese equipo no cabe en el plan."""
    extra = max(users - plan.included_users, 0)
    if extra > 0 and plan.extra_user_price_cop is None:
        return None
    if plan.max_extra_users is not None and extra > plan.max_extra_users:
        return None
    return extra


def quote(plan: Plan, cycle: Cycle, extra_users: int) -> Quote | None:
    """El valor de un periodo con `extra_users` adicionales, o None si no se puede cobrar así."""
    price = plan_price(plan, cycle)
    if price is None or extra_users < 0:
        return None
    unit = extra_user_unit(plan, cycle)
    if unit is None:
        if extra_users > 0:
            return None
        unit = 0
    if plan.max_extra_users is not None and extra_users > plan.max_extra_users:
        return None
    return Quote(
        plan_cop=price,
        included_users=plan.included_users,
        extra_users=extra_users,
        extra_user_unit_cop=unit,
        extra_users_cop=unit * extra_users,
    )


def users_counted(session: Session, organization_id: uuid.UUID, now: datetime.datetime) -> int:
    """Miembros más invitaciones abiertas: las personas por las que se cobra."""
    return organization_repository.seat_member_count(
        session, organization_id
    ) + organization_repository.open_invitation_count(session, organization_id, now)
