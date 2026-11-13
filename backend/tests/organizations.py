"""Datos de prueba para los miembros y las invitaciones (HU-011 y HU-012)."""

import datetime
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.legal import LEGAL_VERSION
from app.core.passwords import hash_password
from app.db.tenancy import TenantContext, set_tenant
from app.models import Membership, Organization, Plan, Subscription, User

CLAVE = "una frase larga y fácil de recordar"
_HASH = hash_password(CLAVE)


@dataclass(frozen=True, slots=True)
class Oficina:
    """Una organización de prueba con su propietario."""

    organization_id: uuid.UUID
    owner: User


def crear_oficina(db: Session, plan: str = "professional", *, nombre: str = "Restrepo") -> Oficina:
    owner = crear_persona(db, f"propietario-{uuid.uuid4().hex[:8]}@example.com", f"Ana {nombre}")
    organization_id = uuid.uuid7()
    set_tenant(db, TenantContext(organization_id=organization_id, user_id=owner.id))
    db.add(Organization(id=organization_id, name=f"{nombre} Abogados"))
    db.flush()
    plan_id = db.scalar(select(Plan.id).where(Plan.code == plan))
    assert plan_id is not None
    db.add_all(
        [
            Membership(organization_id=organization_id, user_id=owner.id, role="owner"),
            Subscription(
                organization_id=organization_id,
                plan_id=plan_id,
                status="active",
                billing_cycle="monthly",
            ),
        ]
    )
    db.flush()
    set_tenant(db, TenantContext())
    return Oficina(organization_id=organization_id, owner=owner)


def crear_persona(db: Session, email: str, nombre: str = "Carlos Gómez") -> User:
    user = User(
        email=email,
        password_hash=_HASH,
        full_name=nombre,
        terms_version=LEGAL_VERSION,
        privacy_version=LEGAL_VERSION,
        consented_at=datetime.datetime.now(datetime.UTC),
    )
    db.add(user)
    db.flush()
    return user


def crear_miembro(db: Session, oficina: Oficina, email: str, role: str) -> User:
    user = crear_persona(db, email)
    set_tenant(db, TenantContext(organization_id=oficina.organization_id, user_id=user.id))
    db.add(Membership(organization_id=oficina.organization_id, user_id=user.id, role=role))
    db.flush()
    set_tenant(db, TenantContext())
    return user
