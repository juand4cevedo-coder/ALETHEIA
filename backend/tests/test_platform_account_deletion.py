"""La plataforma elimina cuentas, por ejemplo las de prueba, sin tocar lo que se debe conservar."""

import uuid

from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_principal, get_session
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Membership, Organization, User
from app.services.sessions import Principal
from tests.conftest import NuevoCliente
from tests.organizations import crear_miembro, crear_oficina, crear_persona
from tests.test_platform_api import _principal, _user


def _as_platform(app: FastAPI, session: Session, admin: User) -> None:
    def principal() -> Principal:
        # Como en la aplicación, la sesión de cada petición queda a nombre de quien la hace.
        set_tenant(session, TenantContext(user_id=admin.id))
        return _principal(admin)

    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[get_principal] = principal


def _delete(client, user_id: uuid.UUID, confirmation: str):  # type: ignore[no-untyped-def]
    return client.post(
        f"/api/v1/platform/users/{user_id}/deletion", json={"confirmation": confirmation}
    )


def test_elimina_una_cuenta_suelta_libera_el_correo_y_deja_auditoria(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    admin = _user(owner_db, "plataforma@example.com", platform_admin=True)
    prueba = crear_persona(owner_db, "prueba@example.com", "Cuenta de Prueba")
    _as_platform(app, owner_db, admin)
    owner_db.commit()
    client = dispositivo()

    response = _delete(client, prueba.id, "  PRUEBA@example.com ")

    assert response.status_code == 204, response.text
    owner_db.expire_all()
    after = owner_db.get_one(User, prueba.id)
    assert after.status == "closed"
    assert after.email == f"closed-{prueba.id}@deleted.invalid"
    assert after.full_name == "Cuenta eliminada"
    assert after.password_hash is None
    audit = owner_db.scalars(
        select(AuditLog).where(AuditLog.action == "account_deleted_by_platform")
    ).all()
    assert [row.target_id for row in audit] == [prueba.id]
    # El correo quedó libre: se puede registrar de nuevo.
    assert crear_persona(owner_db, "prueba@example.com").email == "prueba@example.com"
    assert _delete(client, prueba.id, "prueba@example.com").status_code == 404


def test_pide_el_correo_exacto_y_no_elimina_la_cuenta_de_plataforma(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    admin = _user(owner_db, "plataforma@example.com", platform_admin=True)
    prueba = crear_persona(owner_db, "prueba@example.com")
    _as_platform(app, owner_db, admin)
    owner_db.commit()
    client = dispositivo()

    assert _delete(client, prueba.id, "otro@example.com").status_code == 422
    assert _delete(client, admin.id, admin.email).status_code == 409
    owner_db.expire_all()
    assert owner_db.get_one(User, prueba.id).status == "active"


def test_la_unica_responsable_cierra_su_despacho_y_con_equipo_no_se_puede(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    admin = _user(owner_db, "plataforma@example.com", platform_admin=True)
    solo = crear_oficina(owner_db, nombre="Sola")
    con_equipo = crear_oficina(owner_db, nombre="Equipo")
    crear_miembro(owner_db, con_equipo, "abogada.equipo@example.com", "lawyer")
    _as_platform(app, owner_db, admin)
    owner_db.commit()
    client = dispositivo()

    blocked = _delete(client, con_equipo.owner.id, con_equipo.owner.email)
    closed = _delete(client, solo.owner.id, solo.owner.email)

    assert blocked.status_code == 409
    assert "más personas" in blocked.json()["detail"]
    assert closed.status_code == 204, closed.text
    owner_db.expire_all()
    assert owner_db.get_one(User, con_equipo.owner.id).status == "active"
    assert owner_db.get_one(Organization, solo.organization_id).status == "closed"
    assert owner_db.get_one(Organization, con_equipo.organization_id).status == "active"
    remaining = owner_db.scalars(
        select(Membership).where(Membership.organization_id == solo.organization_id)
    ).all()
    assert remaining == []


def test_solo_la_plataforma_elimina_cuentas(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    comun = _user(owner_db, "comun@example.com")
    prueba = crear_persona(owner_db, "prueba@example.com")
    app.dependency_overrides[get_session] = lambda: owner_db
    app.dependency_overrides[get_principal] = lambda: _principal(comun)
    client = dispositivo()

    assert _delete(client, prueba.id, "prueba@example.com").status_code == 403
