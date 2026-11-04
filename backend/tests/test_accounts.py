"""Pruebas del registro de cuentas (API-003, HU-005, CP-005)."""

import datetime
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.core.config import Settings
from app.core.errors import PROBLEM_JSON
from app.core.legal import LEGAL_VERSION
from app.core.passwords import verify_password
from app.db.tenancy import TenantContext, set_tenant
from app.main import create_app
from app.models import AuditLog, Membership, Organization, Plan, Subscription, User
from app.repositories import accounts as accounts_repository
from app.services.plans import TRIAL_DAYS

_PATH = "/api/v1/auth/register"
_CLAVE = "una frase larga y fácil de recordar"
_OTRA_CLAVE = "otra frase larga y distinta"


@pytest.fixture
def client(settings: Settings, db: Session) -> Iterator[TestClient]:
    app = create_app(settings)
    app.dependency_overrides[get_session] = lambda: db
    with TestClient(app) as test_client:
        yield test_client


def _datos(**cambios: Any) -> dict[str, Any]:
    datos: dict[str, Any] = {
        "account_type": "firm",
        "full_name": "Ana Restrepo",
        "email": "ana@example.com",
        "password": _CLAVE,
        "organization_name": "Restrepo Abogados",
        "legal_version": LEGAL_VERSION,
        "accepts_legal_terms": True,
    }
    datos.update(cambios)
    return datos


def _users(db: Session) -> list[User]:
    return list(db.scalars(select(User)))


def test_crea_la_cuenta_la_organizacion_y_la_prueba(client: TestClient, db: Session) -> None:
    response = client.post(_PATH, json=_datos(email="  Ana@Example.COM "))

    assert response.status_code == 202
    assert response.headers["cache-control"] == "no-store"
    [user] = _users(db)
    assert user.email == "ana@example.com"
    assert user.full_name == "Ana Restrepo"
    assert user.password_hash is not None
    assert verify_password(user.password_hash, _CLAVE)
    assert (user.terms_version, user.privacy_version) == (LEGAL_VERSION, LEGAL_VERSION)
    assert user.email_verified_at is None

    membership = db.scalars(select(Membership).where(Membership.user_id == user.id)).one()
    set_tenant(db, TenantContext(organization_id=membership.organization_id, user_id=user.id))
    assert membership.role == "owner"
    organization = db.get_one(Organization, membership.organization_id)
    assert organization.name == "Restrepo Abogados"

    subscription = db.scalars(select(Subscription)).one()
    trial = db.scalars(select(Plan).where(Plan.code == "trial")).one()
    assert (subscription.plan_id, subscription.status) == (trial.id, "trial")
    assert subscription.trial_ends_at is not None
    remaining = subscription.trial_ends_at - user.consented_at
    assert remaining == datetime.timedelta(days=TRIAL_DAYS)

    [audit] = db.scalars(select(AuditLog)).all()
    assert (audit.action, audit.actor_user_id, audit.organization_id) == (
        "user_registered",
        user.id,
        organization.id,
    )
    # El cliente de pruebas no tiene una IP real: la columna INET la deja vacía.
    assert audit.ip is None
    assert audit.user_agent is not None


def test_quien_trabaja_por_su_cuenta_tiene_una_organizacion_con_su_nombre(
    client: TestClient, db: Session
) -> None:
    datos = _datos(account_type="individual")
    del datos["organization_name"]

    response = client.post(_PATH, json=datos)

    assert response.status_code == 202
    [user] = _users(db)
    membership = db.scalars(select(Membership).where(Membership.user_id == user.id)).one()
    set_tenant(db, TenantContext(organization_id=membership.organization_id, user_id=user.id))
    assert membership.role == "owner"
    assert db.get_one(Organization, membership.organization_id).name == "Ana Restrepo"
    assert db.scalars(select(Subscription)).one().status == "trial"


def test_un_correo_registrado_recibe_la_misma_respuesta(client: TestClient, db: Session) -> None:
    primera = client.post(_PATH, json=_datos())
    segunda = client.post(_PATH, json=_datos(email="ANA@example.com", password=_OTRA_CLAVE))

    assert (primera.status_code, segunda.status_code) == (202, 202)
    assert primera.json() == segunda.json()
    [user] = _users(db)
    assert verify_password(user.password_hash or "", _CLAVE)
    assert db.scalar(select(func.count()).select_from(Membership)) == 1


def test_dos_registros_simultaneos_del_mismo_correo_no_fallan(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Simula que otra petición registró el correo justo después de la comprobación: la base lo
    # rechaza por el índice único y la API responde igual que con un correo registrado.
    client.post(_PATH, json=_datos())
    monkeypatch.setattr(accounts_repository, "email_taken", lambda *_: False)

    response = client.post(_PATH, json=_datos(organization_name="Otra firma"))

    assert response.status_code == 202
    assert len(_users(db)) == 1


def test_una_version_legal_vieja_pide_recargar(client: TestClient, db: Session) -> None:
    response = client.post(_PATH, json=_datos(legal_version="0.9"))

    assert response.status_code == 409
    assert response.headers["content-type"] == PROBLEM_JSON
    assert "Recargue la página" in response.json()["detail"]
    assert _users(db) == []


@pytest.mark.parametrize(
    "cambios",
    [
        {"accepts_legal_terms": False},
        {"password": "x" * 11},
        {"password": "x" * 129},
        {"email": "ana"},
        {"email": "ana@example"},
        {"email": "ana @example.com"},
        {"full_name": "   "},
        {"organization_name": "x" * 121},
        {"es_admin": True},
        {"account_type": "socio"},
        {"organization_name": None},
        {"account_type": "individual"},
    ],
)
def test_rechaza_datos_invalidos(client: TestClient, db: Session, cambios: dict[str, Any]) -> None:
    response = client.post(_PATH, json=_datos(**cambios))

    assert response.status_code == 422
    assert response.headers["content-type"] == PROBLEM_JSON
    assert _users(db) == []


@pytest.mark.parametrize(
    ("cambios", "campo"),
    [
        ({"organization_name": None}, "organization_name"),
        ({"account_type": "individual"}, "organization_name"),
    ],
)
def test_el_error_del_tipo_de_cuenta_queda_en_el_campo_de_la_oficina(
    client: TestClient, cambios: dict[str, Any], campo: str
) -> None:
    response = client.post(_PATH, json=_datos(**cambios))

    assert [error["loc"][-1] for error in response.json()["errors"]] == [campo]


def test_la_longitud_de_la_contrasena_se_mide_normalizada(client: TestClient, db: Session) -> None:
    # Doce letras ñ escritas como n más tilde: 24 caracteres antes de normalizar, 12 después.
    response = client.post(_PATH, json=_datos(password="n\u0303" * 12))

    assert response.status_code == 202
    assert len(_users(db)) == 1


def test_la_ip_admite_veinte_registros_cada_15_minutos(client: TestClient) -> None:
    for numero in range(20):
        response = client.post(_PATH, json=_datos(email=f"persona{numero}@example.com"))
        assert response.status_code == 202

    response = client.post(_PATH, json=_datos(email="persona20@example.com"))
    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0
