"""La cuenta propietaria de la plataforma edita los planes del catálogo, y queda auditado."""

import pytest
from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_principal, get_session
from app.models import AuditLog, Plan
from tests.conftest import NuevoCliente
from tests.test_platform_modules import _principal, _user


def _como(app: FastAPI, owner_db: Session, *, platform_admin: bool) -> None:
    user = _user(owner_db, f"plan-{platform_admin}@example.com", platform_admin=platform_admin)
    app.dependency_overrides[get_session] = lambda: owner_db
    app.dependency_overrides[get_principal] = lambda: _principal(user)


def test_solo_la_cuenta_propietaria_edita_los_planes(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    _como(app, owner_db, platform_admin=False)

    respuesta = dispositivo().patch("/api/v1/platform/plans/trial", json={"included_users": 5})

    assert respuesta.status_code == 403
    assert owner_db.scalars(select(Plan).where(Plan.code == "trial")).one().included_users != 5


def test_editar_un_plan_cambia_solo_lo_enviado_y_deja_la_auditoria(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    _como(app, owner_db, platform_admin=True)
    antes = owner_db.scalars(select(Plan).where(Plan.code == "essential")).one()
    mensual = antes.monthly_price_cop

    respuesta = dispositivo().patch(
        "/api/v1/platform/plans/essential", json={"included_users": 2, "is_public": True}
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["included_users"] == 2
    assert respuesta.json()["monthly_price_cop"] == mensual
    assert respuesta.headers["cache-control"] == "no-store"
    evento = owner_db.scalars(select(AuditLog).where(AuditLog.action == "plan_updated")).one()
    assert evento.organization_id is None
    assert evento.details is not None
    assert evento.details["plan"] == "essential"
    assert evento.details["included_users"] == "1 -> 2"


def test_un_cambio_sin_efecto_no_deja_evento(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    _como(app, owner_db, platform_admin=True)
    actual = owner_db.scalars(select(Plan).where(Plan.code == "essential")).one().included_users

    respuesta = dispositivo().patch(
        "/api/v1/platform/plans/essential", json={"included_users": actual}
    )

    assert respuesta.status_code == 200
    assert owner_db.scalars(select(AuditLog).where(AuditLog.action == "plan_updated")).all() == []


@pytest.mark.parametrize(
    ("codigo", "cuerpo", "estado"),
    [
        # El anual no puede costar más que doce meses.
        ("essential", {"monthly_price_cop": 10_000, "annual_price_cop": 130_000}, 422),
        # Un plan público de pago lleva precio mensual.
        ("essential", {"monthly_price_cop": 0, "is_public": True}, 422),
        ("nada", {"included_users": 3}, 404),
        ("essential", {"included_users": 0}, 422),
        ("essential", {"nombre": "Otro"}, 422),
    ],
)
def test_los_cambios_que_dejan_el_plan_mal_se_rechazan(
    app: FastAPI,
    owner_db: Session,
    dispositivo: NuevoCliente,
    codigo: str,
    cuerpo: dict[str, object],
    estado: int,
) -> None:
    _como(app, owner_db, platform_admin=True)

    respuesta = dispositivo().patch(f"/api/v1/platform/plans/{codigo}", json=cuerpo)

    assert respuesta.status_code == estado, respuesta.text
    assert owner_db.scalars(select(AuditLog).where(AuditLog.action == "plan_updated")).all() == []
