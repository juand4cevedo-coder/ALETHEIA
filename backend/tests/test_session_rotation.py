"""Pruebas de la sesión que se renueva sola y se cierra en uno o en todos los dispositivos
(HU-009, CP-009 y CA-HU-009-01 a CA-HU-009-03)."""

import datetime
import logging
import typing
import uuid
from collections.abc import Callable, Iterator
from http.cookies import SimpleCookie

import httpx2
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.cookies import ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_COOKIE_PATH
from app.api.deps import get_session
from app.core.config import Settings
from app.core.errors import PROBLEM_JSON
from app.core.legal import LEGAL_VERSION
from app.core.passwords import hash_password
from app.db.tenancy import TenantContext, set_tenant
from app.main import create_app
from app.models import AuditLog, Membership, Organization, RefreshToken, User
from app.services.sessions import SESSION_LIFETIME, refresh_token_hash
from tests.conftest import SAME_ORIGIN_HEADERS

_INGRESO = "/api/v1/auth/login"
_RENOVAR = "/api/v1/auth/refresh"
_SALIR = "/api/v1/auth/logout"
_SALIR_DE_TODO = "/api/v1/auth/logout-all"
_PERFIL = "/api/v1/me"
_CLAVE = "una frase larga y fácil de recordar"
_HASH = hash_password(_CLAVE)
_EMAIL = "ana@example.com"

type NuevoCliente = Callable[[], TestClient]


@pytest.fixture
def app(settings: Settings, db: Session) -> FastAPI:
    application = create_app(settings)
    application.dependency_overrides[get_session] = lambda: db
    return application


@pytest.fixture
def dispositivo(app: FastAPI) -> Iterator[NuevoCliente]:
    """Crea navegadores independientes, cada uno con sus propias cookies."""
    abiertos: list[TestClient] = []

    def nuevo() -> TestClient:
        # https: como un navegador, el cliente no devuelve cookies Secure por HTTP.
        cliente = TestClient(app, base_url="https://testserver", headers=SAME_ORIGIN_HEADERS)
        cliente.__enter__()
        abiertos.append(cliente)
        return cliente

    yield nuevo
    for cliente in abiertos:
        cliente.__exit__(None, None, None)


@pytest.fixture
def client(dispositivo: NuevoCliente) -> TestClient:
    return dispositivo()


def _cuenta(db: Session, *, legal_version: str | None = None, **cambios: typing.Any) -> User:
    """Ana, con contraseña, su organización y su membresía de propietaria."""
    version = legal_version or LEGAL_VERSION
    user = User(
        email=_EMAIL,
        password_hash=_HASH,
        full_name="Ana Restrepo",
        terms_version=version,
        privacy_version=version,
        consented_at=datetime.datetime.now(datetime.UTC),
        **cambios,
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
    return user


def _ingresar(client: TestClient) -> None:
    response = client.post(_INGRESO, json={"email": _EMAIL, "password": _CLAVE})
    assert response.status_code == 204


def _cookies(response: httpx2.Response) -> dict[str, SimpleCookie]:
    cookies: dict[str, SimpleCookie] = {}
    for header in response.headers.get_list("set-cookie"):
        cookie = SimpleCookie()
        cookie.load(header)
        [name] = cookie.keys()
        cookies[name] = cookie
    return cookies


def _tokens(db: Session, user: User) -> list[RefreshToken]:
    statement = (
        select(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .order_by(RefreshToken.created_at, RefreshToken.id)
        .execution_options(populate_existing=True)
    )
    return list(db.scalars(statement))


def _auditoria(db: Session, user: User, action: str) -> list[AuditLog]:
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    assert membership is not None
    set_tenant(db, TenantContext(organization_id=membership.organization_id, user_id=user.id))
    statement = select(AuditLog).where(AuditLog.action == action, AuditLog.actor_user_id == user.id)
    return list(db.scalars(statement))


def _con_renovacion(client: TestClient, token: str) -> TestClient:
    """Deja en el navegador solo una cookie de renovación, como quien la copió."""
    client.cookies.clear()
    client.cookies.set(REFRESH_COOKIE, token, path=REFRESH_COOKIE_PATH)
    return client


def _borra_las_dos_cookies(response: httpx2.Response) -> None:
    cookies = _cookies(response)
    assert set(cookies) == {ACCESS_COOKIE, REFRESH_COOKIE}
    for name, cookie in cookies.items():
        morsel = cookie[name]
        assert morsel.value == ""
        assert morsel["max-age"] == "0"
        assert morsel["path"] == ("/" if name == ACCESS_COOKIE else REFRESH_COOKIE_PATH)
        assert morsel["secure"] is True
        assert morsel["httponly"] is True
        assert morsel["samesite"].lower() == "strict"


# --- Renovar sin credenciales y con rotación (CA-HU-009-01) -------------------------------


def test_renovar_entrega_cookies_nuevas_sin_pedir_la_contrasena(
    client: TestClient, db: Session
) -> None:
    _cuenta(db)
    _ingresar(client)
    renovacion_anterior = client.cookies[REFRESH_COOKIE]

    response = client.post(_RENOVAR)

    assert response.status_code == 204
    assert response.headers["cache-control"] == "no-store"
    cookies = _cookies(response)
    assert set(cookies) == {ACCESS_COOKIE, REFRESH_COOKIE}
    for name, cookie in cookies.items():
        morsel = cookie[name]
        assert morsel["httponly"] is True
        assert morsel["secure"] is True
        assert morsel["samesite"].lower() == "strict"
    assert cookies[ACCESS_COOKIE][ACCESS_COOKIE]["path"] == "/"
    assert cookies[REFRESH_COOKIE][REFRESH_COOKIE]["path"] == REFRESH_COOKIE_PATH
    assert client.cookies[REFRESH_COOKIE] != renovacion_anterior
    assert client.get(_PERFIL).status_code == 200


def test_cada_renovacion_gasta_el_token_y_deja_uno_nuevo_en_la_misma_familia(
    client: TestClient, db: Session
) -> None:
    user = _cuenta(db)
    _ingresar(client)
    primero = client.cookies[REFRESH_COOKIE]

    client.post(_RENOVAR)
    segundo = client.cookies[REFRESH_COOKIE]
    client.post(_RENOVAR)

    gastado, intermedio, vigente = _tokens(db, user)
    assert gastado.token_hash == refresh_token_hash(primero)
    assert intermedio.token_hash == refresh_token_hash(segundo)
    assert gastado.used_at is not None
    assert intermedio.used_at is not None
    assert vigente.used_at is None
    assert {gastado.family_id, intermedio.family_id, vigente.family_id} == {gastado.family_id}
    assert all(token.revoked_at is None for token in (gastado, intermedio, vigente))
    # La base solo guarda hashes: ningún token aparece tal cual.
    assert vigente.token_hash != client.cookies[REFRESH_COOKIE].encode()


def test_renovar_no_alarga_la_sesion_mas_alla_de_14_dias_desde_el_ingreso(
    client: TestClient, db: Session
) -> None:
    user = _cuenta(db)
    _ingresar(client)
    [ingreso] = _tokens(db, user)
    # El ingreso fue hace 13 días: a la familia le queda uno.
    restante = datetime.timedelta(days=1)
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.id == ingreso.id)
        .values(expires_at=datetime.datetime.now(datetime.UTC) + restante)
    )

    response = client.post(_RENOVAR)

    assert response.status_code == 204
    _, renovado = _tokens(db, user)
    assert renovado.expires_at == ingreso.expires_at
    morsel = _cookies(response)[REFRESH_COOKIE][REFRESH_COOKIE]
    assert int(morsel["max-age"]) == pytest.approx(restante.total_seconds(), abs=5)
    assert int(morsel["max-age"]) < SESSION_LIFETIME.total_seconds()


def test_renovar_funciona_aunque_falte_aceptar_los_textos_nuevos(
    client: TestClient, db: Session
) -> None:
    # Renovar no da acceso a nada: la aceptación se exige en cada ruta con sesión.
    _cuenta(db, legal_version="2026-01-01")
    _ingresar(client)

    assert client.post(_RENOVAR).status_code == 204


# --- Reutilizar un token ya usado (CA-HU-009-02, CP-009) ----------------------------------


def test_reutilizar_un_token_ya_usado_cierra_toda_la_familia(
    dispositivo: NuevoCliente, db: Session
) -> None:
    user = _cuenta(db)
    persona = dispositivo()
    _ingresar(persona)
    copiado = persona.cookies[REFRESH_COOKIE]
    # La persona renueva; el ladrón se quedó con el token anterior.
    assert persona.post(_RENOVAR).status_code == 204

    ladron = _con_renovacion(dispositivo(), copiado)
    response = ladron.post(_RENOVAR)

    assert response.status_code == 401
    assert response.headers["content-type"] == PROBLEM_JSON
    assert response.json()["detail"] == "Su sesión terminó. Ingrese de nuevo."
    _borra_las_dos_cookies(response)
    assert all(token.revoked_at is not None for token in _tokens(db, user))
    # La sesión legítima de la familia también cae: su acceso y su renovación ya no sirven.
    assert persona.get(_PERFIL).status_code == 401
    assert persona.post(_RENOVAR).status_code == 401


def test_la_reutilizacion_queda_en_la_auditoria_de_la_organizacion(
    dispositivo: NuevoCliente, db: Session
) -> None:
    user = _cuenta(db)
    persona = dispositivo()
    _ingresar(persona)
    copiado = persona.cookies[REFRESH_COOKIE]
    persona.post(_RENOVAR)

    _con_renovacion(dispositivo(), copiado).post(
        _RENOVAR, headers={"User-Agent": "Navegador del ladron"}
    )

    [evento] = _auditoria(db, user, "session_reuse_detected")
    assert evento.organization_id is not None
    assert evento.target_id == user.id
    assert evento.user_agent == "Navegador del ladron"


def test_la_reutilizacion_no_cierra_las_sesiones_de_otros_dispositivos(
    dispositivo: NuevoCliente, db: Session
) -> None:
    _cuenta(db)
    portatil = dispositivo()
    celular = dispositivo()
    _ingresar(portatil)
    _ingresar(celular)
    copiado = portatil.cookies[REFRESH_COOKIE]
    portatil.post(_RENOVAR)

    _con_renovacion(dispositivo(), copiado).post(_RENOVAR)

    assert portatil.get(_PERFIL).status_code == 401
    # Otro ingreso es otra familia: el celular sigue trabajando.
    assert celular.get(_PERFIL).status_code == 200
    assert celular.post(_RENOVAR).status_code == 204


def test_una_familia_ya_revocada_no_vuelve_a_registrar_la_reutilizacion(
    dispositivo: NuevoCliente, db: Session
) -> None:
    user = _cuenta(db)
    persona = dispositivo()
    _ingresar(persona)
    copiado = persona.cookies[REFRESH_COOKIE]
    persona.post(_RENOVAR)
    ladron = dispositivo()

    _con_renovacion(ladron, copiado).post(_RENOVAR)
    assert _con_renovacion(ladron, copiado).post(_RENOVAR).status_code == 401

    assert len(_auditoria(db, user, "session_reuse_detected")) == 1


# --- Renovaciones que no sirven ------------------------------------------------------------


def test_sin_cookie_de_renovacion_responde_401_y_borra_las_cookies(client: TestClient) -> None:
    response = client.post(_RENOVAR)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == 'Cookie realm="aletheia"'
    assert response.headers["cache-control"] == "no-store"
    _borra_las_dos_cookies(response)


@pytest.mark.parametrize("token", ["", "inventado", "x" * 43, "x" * 2000])
def test_un_token_inexistente_o_desmesurado_responde_401(client: TestClient, token: str) -> None:
    response = _con_renovacion(client, token).post(_RENOVAR)

    assert response.status_code == 401
    assert response.json()["detail"] == "Su sesión terminó. Ingrese de nuevo."


def test_una_familia_vencida_no_se_renueva(client: TestClient, db: Session) -> None:
    user = _cuenta(db)
    _ingresar(client)
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .values(expires_at=datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=1))
    )

    assert client.post(_RENOVAR).status_code == 401
    # Vencer no es una reutilización: no hay nada que auditar.
    assert _auditoria(db, user, "session_reuse_detected") == []


def test_una_cuenta_bloqueada_no_renueva_su_sesion(client: TestClient, db: Session) -> None:
    user = _cuenta(db)
    _ingresar(client)
    db.execute(update(User).where(User.id == user.id).values(status="blocked"))

    assert client.post(_RENOVAR).status_code == 401
    [token] = _tokens(db, user)
    # El token no se gasta: si la cuenta se desbloquea, sigue siendo el mismo.
    assert token.used_at is None


def test_renovar_exige_el_encabezado_propio_de_la_interfaz(client: TestClient, db: Session) -> None:
    # Otro sitio no puede provocar la renovación: sin el encabezado no hay rotación (ADR-028).
    user = _cuenta(db)
    _ingresar(client)

    response = client.post(_RENOVAR, headers={"X-Aletheia-Request": ""})

    assert response.status_code == 403
    [token] = _tokens(db, user)
    assert token.used_at is None


def test_la_renovacion_no_deja_tokens_en_los_registros(
    client: TestClient, db: Session, caplog: pytest.LogCaptureFixture
) -> None:
    _cuenta(db)
    _ingresar(client)
    anterior = client.cookies[REFRESH_COOKIE]

    with caplog.at_level(logging.DEBUG):
        client.post(_RENOVAR)
        _con_renovacion(client, anterior).post(_RENOVAR)

    registros = caplog.text
    assert anterior not in registros
    assert "aletheia_refresh" not in registros


# --- Cerrar la sesión de este dispositivo (RF-011) -----------------------------------------


def test_cerrar_la_sesion_borra_las_cookies_y_revoca_su_familia(
    client: TestClient, db: Session
) -> None:
    user = _cuenta(db)
    _ingresar(client)
    acceso = client.cookies[ACCESS_COOKIE]
    renovacion = client.cookies[REFRESH_COOKIE]

    response = client.post(_SALIR)

    assert response.status_code == 204
    assert response.headers["cache-control"] == "no-store"
    _borra_las_dos_cookies(response)
    assert all(token.revoked_at is not None for token in _tokens(db, user))
    # Aunque alguien hubiera copiado las cookies, ya no abren nada.
    client.cookies.set(ACCESS_COOKIE, acceso)
    assert client.get(_PERFIL).status_code == 401
    assert _con_renovacion(client, renovacion).post(_RENOVAR).status_code == 401


def test_cerrar_la_sesion_no_cierra_la_de_otro_dispositivo(
    dispositivo: NuevoCliente, db: Session
) -> None:
    _cuenta(db)
    portatil = dispositivo()
    celular = dispositivo()
    _ingresar(portatil)
    _ingresar(celular)

    portatil.post(_SALIR)

    assert celular.get(_PERFIL).status_code == 200


def test_cerrar_la_sesion_queda_en_la_auditoria(client: TestClient, db: Session) -> None:
    user = _cuenta(db)
    _ingresar(client)

    client.post(_SALIR)

    [evento] = _auditoria(db, user, "logout")
    assert evento.target_id == user.id


def test_se_puede_cerrar_la_sesion_sin_aceptar_los_textos_nuevos(
    client: TestClient, db: Session
) -> None:
    # Nadie queda atrapado en una sesión por no aceptar unos textos (ADR-032).
    _cuenta(db, legal_version="2026-01-01")
    _ingresar(client)

    assert client.post(_SALIR).status_code == 204


@pytest.mark.parametrize("ruta", [_SALIR, _SALIR_DE_TODO])
def test_cerrar_sin_sesion_responde_401(client: TestClient, ruta: str) -> None:
    response = client.post(ruta)

    assert response.status_code == 401
    assert response.headers["content-type"] == PROBLEM_JSON


@pytest.mark.parametrize("ruta", [_SALIR, _SALIR_DE_TODO])
def test_cerrar_exige_el_encabezado_propio_de_la_interfaz(
    client: TestClient, db: Session, ruta: str
) -> None:
    user = _cuenta(db)
    _ingresar(client)

    assert client.post(ruta, headers={"X-Aletheia-Request": ""}).status_code == 403
    assert all(token.revoked_at is None for token in _tokens(db, user))


# --- Cerrar todas las sesiones (CA-HU-009-03) -----------------------------------------------


def test_cerrar_todas_las_sesiones_saca_de_inmediato_a_los_demas_dispositivos(
    dispositivo: NuevoCliente, db: Session
) -> None:
    user = _cuenta(db)
    portatil = dispositivo()
    celular = dispositivo()
    tableta = dispositivo()
    for equipo in (portatil, celular, tableta):
        _ingresar(equipo)
    tableta.post(_RENOVAR)

    response = portatil.post(_SALIR_DE_TODO)

    assert response.status_code == 204
    _borra_las_dos_cookies(response)
    assert all(token.revoked_at is not None for token in _tokens(db, user))
    # Sus tokens de acceso todavía no vencen, pero la API ya no los acepta.
    for equipo in (celular, tableta):
        assert equipo.get(_PERFIL).status_code == 401
        assert equipo.post(_RENOVAR).status_code == 401


def test_cerrar_todas_las_sesiones_queda_en_la_auditoria(client: TestClient, db: Session) -> None:
    user = _cuenta(db)
    _ingresar(client)

    client.post(_SALIR_DE_TODO, headers={"User-Agent": "Navegador de Ana"})

    [evento] = _auditoria(db, user, "sessions_revoked")
    assert evento.user_agent == "Navegador de Ana"


def test_cerrar_todas_no_toca_las_sesiones_de_otra_persona(
    dispositivo: NuevoCliente, db: Session
) -> None:
    _cuenta(db)
    otra = User(
        email="otra@example.com",
        password_hash=_HASH,
        full_name="Otra persona",
        terms_version=LEGAL_VERSION,
        privacy_version=LEGAL_VERSION,
        consented_at=datetime.datetime.now(datetime.UTC),
    )
    db.add(otra)
    db.flush()
    ana = dispositivo()
    _ingresar(ana)
    vecina = dispositivo()
    assert (
        vecina.post(_INGRESO, json={"email": "otra@example.com", "password": _CLAVE}).status_code
        == 204
    )

    ana.post(_SALIR_DE_TODO)

    assert vecina.get(_PERFIL).status_code == 200
