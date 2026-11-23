"""Segundo factor: activación, ingreso en dos pasos, códigos de respaldo y límites."""

import base64
import datetime

from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core import two_factor as totp
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, User, UserTwoFactor
from tests.conftest import NuevoCliente
from tests.organizations import CLAVE, Oficina, crear_oficina

_LOGIN = "/api/v1/auth/login"
_SECOND_STEP = "/api/v1/auth/login/two-factor"
_BASE = "/api/v1/account/two-factor"


def _secret_bytes(secret: str) -> bytes:
    return base64.b32decode(secret + "=" * (-len(secret) % 8))


def _verified_client(dispositivo: NuevoCliente, db: Session, user: User) -> TestClient:
    db.execute(
        update(User)
        .where(User.id == user.id)
        .values(email_verified_at=datetime.datetime.now(datetime.UTC))
    )
    db.flush()
    client = dispositivo()
    response = client.post(_LOGIN, json={"email": user.email, "password": CLAVE})
    assert response.status_code == 204, response.text
    return client


def _activate(client: TestClient) -> tuple[bytes, list[str]]:
    """Activa el segundo factor y devuelve el secreto y los códigos de respaldo."""
    setup = client.post(f"{_BASE}/setup")
    assert setup.status_code == 200, setup.text
    secret = _secret_bytes(setup.json()["secret"])
    code = totp.code_for(secret, totp.current_step())
    enabled = client.post(f"{_BASE}/enable", json={"code": code})
    assert enabled.status_code == 200, enabled.text
    return secret, enabled.json()["recovery_codes"]


def _events(db: Session, office: Oficina, action: str) -> int:
    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))
    return len(
        list(
            db.scalars(
                select(AuditLog).where(
                    AuditLog.organization_id == office.organization_id, AuditLog.action == action
                )
            )
        )
    )


def test_la_activacion_exige_un_codigo_correcto_y_entrega_los_codigos_de_respaldo(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    client = _verified_client(dispositivo, db, office.owner)
    assert client.get(_BASE).json() == {"enabled": False, "recovery_codes_remaining": 0}

    setup = client.post(f"{_BASE}/setup").json()
    assert setup["uri"].startswith("otpauth://totp/ALETHEIA")
    assert setup["secret"] in setup["uri"]
    assert client.post(f"{_BASE}/enable", json={"code": "000000"}).status_code == 422

    secret = _secret_bytes(setup["secret"])
    code = totp.code_for(secret, totp.current_step())
    enabled = client.post(f"{_BASE}/enable", json={"code": code})

    assert enabled.status_code == 200, enabled.text
    assert enabled.headers["cache-control"] == "no-store"
    codes = enabled.json()["recovery_codes"]
    assert len(codes) == 10
    assert len(set(codes)) == 10
    assert client.get(_BASE).json() == {"enabled": True, "recovery_codes_remaining": 10}
    assert client.post(f"{_BASE}/setup").status_code == 409
    assert _events(db, office, "two_factor_enabled") == 1


def test_con_segundo_factor_la_contrasena_no_abre_sesion(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    secret, _ = _activate(_verified_client(dispositivo, db, office.owner))

    fresh = dispositivo()
    first = fresh.post(_LOGIN, json={"email": office.owner.email, "password": CLAVE})

    assert first.status_code == 202, first.text
    assert first.json() == {"two_factor_required": True}
    assert "__Host-aletheia_2fa" in first.headers["set-cookie"]
    assert "__Host-aletheia_access" not in first.headers["set-cookie"]
    # Sin segundo paso no hay sesión.
    assert fresh.get("/api/v1/me").status_code == 401

    # Un código del paso siguiente (la ventana lo admite) y posterior al usado al activar.
    code = totp.code_for(secret, totp.current_step() + 1)
    second = fresh.post(_SECOND_STEP, json={"code": code})
    assert second.status_code == 204, second.text
    assert fresh.get("/api/v1/me").status_code == 200

    # El mismo código no sirve dos veces.
    again = dispositivo()
    again.post(_LOGIN, json={"email": office.owner.email, "password": CLAVE})
    assert again.post(_SECOND_STEP, json={"code": code}).status_code == 401


def test_un_codigo_de_respaldo_sirve_una_sola_vez(dispositivo: NuevoCliente, db: Session) -> None:
    office = crear_oficina(db)
    _, codes = _activate(_verified_client(dispositivo, db, office.owner))

    first = dispositivo()
    first.post(_LOGIN, json={"email": office.owner.email, "password": CLAVE})
    assert first.post(_SECOND_STEP, json={"code": codes[0].lower()}).status_code == 204
    assert _events(db, office, "two_factor_recovery_used") == 1

    second = dispositivo()
    second.post(_LOGIN, json={"email": office.owner.email, "password": CLAVE})
    assert second.post(_SECOND_STEP, json={"code": codes[0]}).status_code == 401
    third = dispositivo()
    third.post(_LOGIN, json={"email": office.owner.email, "password": CLAVE})
    assert third.post(_SECOND_STEP, json={"code": codes[1]}).status_code == 204
    assert first.get(_BASE).json()["recovery_codes_remaining"] == 8


def test_los_codigos_errados_se_limitan_y_quedan_en_la_auditoria(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    _activate(_verified_client(dispositivo, db, office.owner))
    client = dispositivo()
    client.post(_LOGIN, json={"email": office.owner.email, "password": CLAVE})

    for _ in range(5):
        assert client.post(_SECOND_STEP, json={"code": "000000"}).status_code == 401
    blocked = client.post(_SECOND_STEP, json={"code": "000000"})

    assert blocked.status_code == 429
    assert _events(db, office, "two_factor_failed") == 5


def test_sin_cookie_o_con_un_desafio_ajeno_el_segundo_paso_se_rechaza(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    _activate(_verified_client(dispositivo, db, office.owner))

    assert dispositivo().post(_SECOND_STEP, json={"code": "123456"}).status_code == 401
    forged = dispositivo().post(
        _SECOND_STEP,
        json={"code": "123456"},
        headers={"Cookie": "__Host-aletheia_2fa=no-es-un-token"},
    )
    assert forged.status_code == 401


def test_desactivar_exige_un_codigo_y_devuelve_el_ingreso_normal(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    client = _verified_client(dispositivo, db, office.owner)
    _, codes = _activate(client)

    assert client.post(f"{_BASE}/disable", json={"code": "000000"}).status_code == 422
    assert client.get(_BASE).json()["enabled"] is True
    disabled = client.post(f"{_BASE}/disable", json={"code": codes[0]})

    assert disabled.status_code == 204, disabled.text
    assert client.get(_BASE).json() == {"enabled": False, "recovery_codes_remaining": 0}
    assert _events(db, office, "two_factor_disabled") == 1
    normal = dispositivo().post(_LOGIN, json={"email": office.owner.email, "password": CLAVE})
    assert normal.status_code == 204


def test_renovar_los_codigos_invalida_los_anteriores(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    client = _verified_client(dispositivo, db, office.owner)
    _, old = _activate(client)

    renewed = client.post(f"{_BASE}/recovery-codes", json={"code": old[0]})

    assert renewed.status_code == 200, renewed.text
    new = renewed.json()["recovery_codes"]
    assert len(new) == 10
    assert set(new).isdisjoint(old)
    fresh = dispositivo()
    fresh.post(_LOGIN, json={"email": office.owner.email, "password": CLAVE})
    assert fresh.post(_SECOND_STEP, json={"code": old[1]}).status_code == 401
    assert fresh.post(_SECOND_STEP, json={"code": new[0]}).status_code == 204
    assert _events(db, office, "two_factor_codes_regenerated") == 1


def test_el_secreto_no_se_guarda_en_claro(dispositivo: NuevoCliente, db: Session) -> None:
    office = crear_oficina(db)
    client = _verified_client(dispositivo, db, office.owner)
    secret, _ = _activate(client)

    stored = db.scalars(
        select(UserTwoFactor.secret_encrypted).where(UserTwoFactor.user_id == office.owner.id)
    ).one()
    assert secret not in stored
    assert len(stored) > len(secret)
