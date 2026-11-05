"""Consultas de las cuentas: crearlas y encontrar a su persona y su organización (DAT-01, DAT-04
a DAT-06 y DAT-09)."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AuditLog, Membership, Organization, Plan, Subscription, User


def user_by_email(session: Session, email: str) -> User | None:
    """La persona con ese correo, sin distinguir mayúsculas (IDX-001), o None."""
    statement = select(User).where(func.lower(User.email) == email.lower()).limit(1)
    return session.scalar(statement)


def plan_id_by_code(session: Session, code: str) -> uuid.UUID:
    """Identificador de un plan del catálogo; sin él el catálogo está incompleto."""
    plan_id = session.scalar(select(Plan.id).where(Plan.code == code))
    if plan_id is None:
        msg = f"El catálogo no tiene el plan {code}"
        raise LookupError(msg)
    return plan_id


def add_account(
    session: Session,
    *,
    user: User,
    organization: Organization,
    subscription: Subscription,
    audit: AuditLog,
) -> None:
    """Agrega la persona, su organización, su membresía de propietaria, la suscripción y el
    evento de auditoría. La sesión ya debe tener el contexto de esa organización."""
    session.add_all([user, organization])
    session.flush()
    session.add_all(
        [
            Membership(organization_id=organization.id, user_id=user.id, role="owner"),
            subscription,
            audit,
        ]
    )
    session.flush()


def membership_of(session: Session, user_id: uuid.UUID) -> Membership | None:
    """La membresía de la persona, o None si no pertenece a ninguna organización.

    Una persona tiene a lo sumo una (RN-011). Row-Level Security solo la deja ver si la sesión
    ya tiene a esa persona en su contexto.
    """
    return session.scalar(select(Membership).where(Membership.user_id == user_id))
