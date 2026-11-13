"""Pruebas de la aceptación de los textos legales vigentes (RN-028, RN-029, TT-012).

Quien aceptó una versión anterior conserva su sesión y su perfil, pero el resto de la API le
responde 403 hasta que acepte la vigente. Cada aceptación deja una prueba que no se edita ni se
borra desde la aplicación.
"""

import datetime
import typing
import uuid
from collections.abc import Iterator

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import delete, select, update
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.api.deps import get_principal, get_session
from app.core.config import Settings
from app.core.errors import PROBLEM_JSON
from app.core.legal import LEGAL_ACCEPTANCE_REQUIRED, LEGAL_VERSION
from app.core.passwords import hash_password
from app.db.tenancy import TenantContext, set_tenant
from app.main import create_app
from app.models import AuditLog, LegalAcceptance, Membership, Organization, User
from app.services.sessions import Principal
from tests.conftest import SAME_ORIGIN_HEADERS

_INGRESO = "/api/v1/auth/login"
_REGISTRO = "/api/v1/auth/register"
_PERFIL = "/api/v1/me"
_ACEPTAR = "/api/v1/me/legal-acceptance"
# Ruta solo de prueba que usa la dependencia por defecto, como lo hará cualquier ruta nueva.
_PROTEGIDA = "/api/v1/prueba-protegida"
_CLAVE = "una frase larga y fácil de recordar"
_HASH = hash_password(_CLAVE)
_VERSION_ANTERIOR = "2026-11-02"


def _con_ruta_protegida(app: FastAPI) -> FastAPI:
    @app.get(_PROTEGIDA)
    def protegida(principal: typing.Annotated[Principal, Depends(get_principal)]) -> dict[str, str]:
        return {"user_id": str(principal.user_id)}

    return app


@pytest.fixture
def client(settings: Settings, db: Session) -> Iterator[TestClient]:
    app = _con_ruta_protegida(create_app(settings))
    app.dependency_overrides[get_session] = lambda: db
    # https: el cliente, como un navegador, no devuelve cookies Secure por HTTP.
    with TestClient(app, base_url="https://testserver", headers=SAME_ORIGIN_HEADERS) as test:
        yield test


def _cuenta(db: Session, version: str = _VERSION_ANTERIOR) -> tuple[User, uuid.UUID]:
    """Una persona que aceptó la versión dada, con su organización."""
    user = User(
        email="ana@example.com",
        password_hash=_HASH,
        full_name="Ana Restrepo",
        terms_version=version,
        privacy_version=version,
        consented_at=datetime.datetime(2026, 11, 2, 15, tzinfo=datetime.UTC),
    )
    db.add(user)
    db.flush()
    organization_id = uuid.uuid7()
    set_tenant(db, TenantContext(organization_id=organization_id, user_id=user.id))
    db.add(Organization(id=organization_id, name="Restrepo Abogados"))
    db.flush()
    db.add(Membership(organization_id=organization_id, user_id=user.id, role="owner"))
    db.flush()
    set_tenant(db, TenantContext())
    return user, organization_id


def _ingresar(client: TestClient) -> None:
    response = client.post(_INGRESO, json={"email": "ana@example.com", "password": _CLAVE})
    assert response.status_code == 204


def _aceptar(client: TestClient, **cambios: typing.Any) -> typing.Any:
    cuerpo = {"legal_version": LEGAL_VERSION, "accepts_legal_terms": True, **cambios}
    return client.post(_ACEPTAR, json=cuerpo)


def _pruebas(db: Session, user: User) -> list[LegalAcceptance]:
    statement = (
        select(LegalAcceptance)
        .where(LegalAcceptance.user_id == user.id)
        .order_by(LegalAcceptance.accepted_at)
    )
    return list(db.scalars(statement))


def _auditoria(db: Session, organization_id: uuid.UUID) -> list[AuditLog]:
    set_tenant(db, TenantContext(organization_id=organization_id))
    statement = select(AuditLog).where(AuditLog.action == "legal_accepted")
    return list(db.scalars(statement))


# --- Registro ------------------------------------------------------------------------------


def test_el_registro_deja_la_prueba_de_la_aceptacion(client: TestClient, db: Session) -> None:
    datos = {
        "account_type": "individual",
        "full_name": "Ana Restrepo",
        "email": "ana@example.com",
        "password": _CLAVE,
        "legal_version": LEGAL_VERSION,
        "accepts_legal_terms": True,
    }

    assert client.post(_REGISTRO, json=datos).status_code == 202

    user = db.scalars(select(User)).one()
    [prueba] = _pruebas(db, user)
    assert (prueba.version, prueba.context, prueba.email) == (
        LEGAL_VERSION,
        "registration",
        "ana@example.com",
    )
    assert prueba.accepted_at == user.consented_at


# --- Textos al día -------------------------------------------------------------------------


def test_con_los_textos_al_dia_el_perfil_no_pide_nada_y_la_api_responde(
    client: TestClient, db: Session
) -> None:
    _cuenta(db, LEGAL_VERSION)
    _ingresar(client)

    legal = client.get(_PERFIL).json()["legal"]

    assert legal == {
        "accepted_version": LEGAL_VERSION,
        "current_version": LEGAL_VERSION,
        "acceptance_required": False,
    }
    assert client.get(_PROTEGIDA).status_code == 200


# --- Textos nuevos sin aceptar -------------------------------------------------------------


def test_con_textos_viejos_conserva_la_sesion_y_el_perfil_pero_la_api_responde_403(
    client: TestClient, db: Session
) -> None:
    _cuenta(db)
    _ingresar(client)

    perfil = client.get(_PERFIL)
    assert perfil.status_code == 200
    assert perfil.json()["legal"] == {
        "accepted_version": _VERSION_ANTERIOR,
        "current_version": LEGAL_VERSION,
        "acceptance_required": True,
    }

    response = client.get(_PROTEGIDA)
    assert response.status_code == 403
    assert response.headers["content-type"] == PROBLEM_JSON
    assert response.headers["cache-control"] == "no-store"
    problema = response.json()
    # Un tipo propio: la interfaz lo distingue de un permiso que falta.
    assert problema["type"] == LEGAL_ACCEPTANCE_REQUIRED
    assert problema["title"] == "Forbidden"
    assert "cambiaron" in problema["detail"]


def test_aceptar_los_textos_vigentes_deja_la_prueba_y_abre_la_api(
    client: TestClient, db: Session
) -> None:
    user, organization_id = _cuenta(db)
    _ingresar(client)

    response = _aceptar(client)

    assert response.status_code == 204
    assert response.headers["cache-control"] == "no-store"
    db.refresh(user)
    assert (user.terms_version, user.privacy_version) == (LEGAL_VERSION, LEGAL_VERSION)
    assert user.consented_at > datetime.datetime(2026, 11, 2, 15, tzinfo=datetime.UTC)
    [prueba] = _pruebas(db, user)
    assert (prueba.version, prueba.context, prueba.email) == (
        LEGAL_VERSION,
        "renewal",
        "ana@example.com",
    )
    assert prueba.accepted_at == user.consented_at
    # Queda en la auditoría de su organización, donde la ve el propietario (HU-014).
    [evento] = _auditoria(db, organization_id)
    assert (evento.actor_user_id, evento.target_id) == (user.id, user.id)

    assert client.get(_PROTEGIDA).status_code == 200
    assert client.get(_PERFIL).json()["legal"]["acceptance_required"] is False


def test_aceptar_dos_veces_deja_una_sola_prueba(client: TestClient, db: Session) -> None:
    user, organization_id = _cuenta(db)
    _ingresar(client)

    assert _aceptar(client).status_code == 204
    assert _aceptar(client).status_code == 204

    assert len(_pruebas(db, user)) == 1
    assert len(_auditoria(db, organization_id)) == 1


def test_aceptar_una_version_que_ya_no_es_la_vigente_pide_recargar(
    client: TestClient, db: Session
) -> None:
    user, _ = _cuenta(db)
    _ingresar(client)

    response = _aceptar(client, legal_version=_VERSION_ANTERIOR)

    assert response.status_code == 409
    assert response.headers["content-type"] == PROBLEM_JSON
    assert "Recargue" in response.json()["detail"]
    db.refresh(user)
    assert user.terms_version == _VERSION_ANTERIOR
    assert _pruebas(db, user) == []
    assert client.get(_PROTEGIDA).status_code == 403


@pytest.mark.parametrize(
    "cambios",
    [
        {"accepts_legal_terms": False},
        {"accepts_legal_terms": None},
        {"legal_version": "x" * 21},
    ],
)
def test_la_aceptacion_nunca_se_presume(
    client: TestClient, db: Session, cambios: dict[str, typing.Any]
) -> None:
    user, _ = _cuenta(db)
    _ingresar(client)

    response = _aceptar(client, **cambios)

    assert response.status_code == 422
    assert _pruebas(db, user) == []


def test_sin_el_campo_de_aceptacion_tampoco_se_acepta(client: TestClient, db: Session) -> None:
    user, _ = _cuenta(db)
    _ingresar(client)

    response = client.post(_ACEPTAR, json={"legal_version": LEGAL_VERSION})

    assert response.status_code == 422
    assert _pruebas(db, user) == []


def test_sin_sesion_no_se_puede_aceptar(client: TestClient) -> None:
    response = _aceptar(client)

    assert response.status_code == 401


# --- La prueba no se toca ------------------------------------------------------------------


def _una_prueba(db: Session) -> LegalAcceptance:
    user, _ = _cuenta(db)
    prueba = LegalAcceptance(
        user_id=user.id, email=user.email, version=LEGAL_VERSION, context="renewal"
    )
    db.add(prueba)
    db.flush()
    return prueba


def test_la_aplicacion_no_puede_editar_una_prueba(db: Session) -> None:
    prueba = _una_prueba(db)

    with pytest.raises(ProgrammingError, match="permission denied"), db.begin_nested():
        db.execute(
            update(LegalAcceptance)
            .where(LegalAcceptance.id == prueba.id)
            .values(version="2020-01-01")
        )


def test_la_aplicacion_no_puede_borrar_una_prueba(db: Session) -> None:
    prueba = _una_prueba(db)

    with pytest.raises(ProgrammingError, match="permission denied"), db.begin_nested():
        db.execute(delete(LegalAcceptance).where(LegalAcceptance.id == prueba.id))


def test_la_prueba_sobrevive_a_la_cuenta(owner_db: Session) -> None:
    user = User(
        email="ana@example.com",
        password_hash=_HASH,
        full_name="Ana Restrepo",
        terms_version=LEGAL_VERSION,
        privacy_version=LEGAL_VERSION,
        consented_at=datetime.datetime.now(datetime.UTC),
    )
    owner_db.add(user)
    owner_db.flush()
    prueba = LegalAcceptance(
        user_id=user.id, email=user.email, version=LEGAL_VERSION, context="registration"
    )
    owner_db.add(prueba)
    owner_db.flush()

    owner_db.delete(user)
    owner_db.flush()
    owner_db.expire_all()

    conservada = owner_db.get(LegalAcceptance, prueba.id)
    assert conservada is not None
    assert (conservada.user_id, conservada.email) == (None, "ana@example.com")
