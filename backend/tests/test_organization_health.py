"""La salud del despacho es solo de los gestores y no mezcla datos de otra organización."""

import datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, User
from tests.conftest import NuevoCliente
from tests.organizations import CLAVE, Oficina, crear_miembro, crear_oficina

PATH = "/api/v1/organization/health"


def _login(dispositivo: NuevoCliente, user: User) -> TestClient:
    client = dispositivo()
    response = client.post("/api/v1/auth/login", json={"email": user.email, "password": CLAVE})
    assert response.status_code == 204, response.text
    return client


def _event(db: Session, office: Oficina, action: str, *, days_ago: int = 0) -> None:
    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))
    db.add(
        AuditLog(
            organization_id=office.organization_id,
            actor_user_id=office.owner.id,
            action=action,
            created_at=datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=days_ago),
        )
    )
    db.flush()


def test_la_salud_cuenta_solo_los_eventos_recientes_de_su_despacho(
    dispositivo: NuevoCliente, db: Session
) -> None:
    mine = crear_oficina(db)
    other = crear_oficina(db)
    admin = crear_miembro(db, mine, "admin-salud@example.com", "admin")
    _event(db, mine, "login")
    _event(db, mine, "login")
    _event(db, mine, "login_failed")
    _event(db, mine, "role_changed")
    _event(db, mine, "login", days_ago=30)
    _event(db, other, "login")
    _event(db, other, "login_failed")

    client = _login(dispositivo, admin)
    response = client.get(PATH)

    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    # Dos inicios recientes y el del propio administrador; el de hace 30 días queda fuera.
    assert body["security"]["logins"] == 3
    assert body["security"]["failed_logins"] == 1
    assert body["security"]["role_changes"] == 1
    assert body["window_days"] == 7
    assert body["members"] >= 2
    assert body["storage_used_bytes"] >= 0


def test_un_abogado_no_ve_la_salud_del_despacho(dispositivo: NuevoCliente, db: Session) -> None:
    office = crear_oficina(db)
    lawyer = crear_miembro(db, office, "abogada-salud@example.com", "lawyer")

    assert _login(dispositivo, lawyer).get(PATH).status_code == 403
    assert dispositivo().get(PATH).status_code == 401
