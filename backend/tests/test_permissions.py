"""La matriz de capacidades no mezcla plataforma y despachos."""

import datetime

import pytest
from psycopg.errors import InsufficientPrivilege
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.legal import LEGAL_VERSION
from app.core.permissions import ROLE_PERMISSIONS, has_permission, permissions_for
from app.maintenance.platform_owner import grant_platform_owner
from app.models import AuditLog, User
from app.models.organization import MEMBER_ROLES
from tests.conftest import rejected


def test_todos_los_roles_tienen_permisos_definidos() -> None:
    assert set(ROLE_PERMISSIONS) == set(MEMBER_ROLES)


@pytest.mark.parametrize("role", MEMBER_ROLES)
def test_administrar_plataforma_no_da_acceso_a_otro_despacho(role: str) -> None:
    assert permissions_for(role, platform_admin=True) - permissions_for(role) == {"platform.manage"}
    assert not has_permission(None, "team.manage")
    assert not has_permission(None, "cases.create")


def test_permisos_actuales_por_rol() -> None:
    assert has_permission("owner", "team.manage")
    assert has_permission("admin", "team.manage")
    assert not has_permission("lawyer", "team.manage")
    assert not has_permission("assistant", "team.manage")
    assert has_permission("lawyer", "cases.create")
    assert not has_permission("assistant", "cases.create")
    for role in MEMBER_ROLES:
        assert has_permission(role, "cases.read_assigned")


def test_la_aplicacion_no_puede_asignar_administracion_de_plataforma(db: Session) -> None:
    with rejected(db, InsufficientPrivilege):
        db.execute(text("UPDATE users SET is_platform_admin = true WHERE false"))
    with rejected(db, InsufficientPrivilege):
        db.execute(
            text(
                "INSERT INTO users (email, is_platform_admin) "
                "SELECT 'nadie@example.com', true WHERE false"
            )
        )


def test_el_dueno_del_esquema_asigna_una_cuenta_verificada_y_deja_auditoria(
    owner_db: Session,
) -> None:
    now = datetime.datetime.now(datetime.UTC)
    user = User(
        email="propietaria@example.com",
        full_name="Propietaria",
        email_verified_at=now,
        terms_version=LEGAL_VERSION,
        privacy_version=LEGAL_VERSION,
        consented_at=now,
    )
    owner_db.add(user)
    owner_db.flush()

    assert grant_platform_owner(owner_db, user.email) == user.id
    assert grant_platform_owner(owner_db, user.email) == user.id
    assert user.is_platform_admin
    events = owner_db.scalars(
        select(AuditLog).where(AuditLog.action == "platform_admin_granted")
    ).all()
    assert len(events) == 1
    assert events[0].target_id == user.id
