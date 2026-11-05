"""Pruebas del ingreso con correo y contraseña (HU-007, CP-007) y de la sesión que se comprueba
en cada petición (API-014 y la base de CA-HU-009-03)."""

import datetime
import hashlib
import logging
import typing
import uuid
from collections.abc import Iterator
from http.cookies import SimpleCookie

import httpx2
import pytest
from argon2 import PasswordHasher, Type
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.cookies import ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_COOKIE_PATH
from app.api.deps import get_session
from app.core.config import Settings
from app.core.errors import PROBLEM_JSON
from app.core.legal import LEGAL_VERSION
from app.core.passwords import hash_password, verify_password
from app.core.tokens import issue_access_token
from app.db.tenancy import TenantContext, set_tenant
from app.main import create_app
from app.models import AuditLog, Membership, Organization, RateLimitEvent, RefreshToken, User
from app.models.organization import MEMBER_ROLES
from app.schemas.me import MemberRole
from app.services.sessions import SESSION_LIFETIME, refresh_token_hash
from tests.conftest import SAME_ORIGIN_HEADERS, TEST_SIGNING_KEY

_INGRESO = "/api/v1/auth/login"
_PERFIL = "/api/v1/me"
_CLAVE = "una frase larga y fácil de recordar"
# Un solo hash para todas las pruebas: Argon2id tarda a propósito.
_HASH = hash_password(_CLAVE)
_MENSAJE_GENERICO = "El correo o la contraseña no coinciden. Revise los datos."


@pytest.fixture
def client(settings: Settings, db: Session) -> Iterator[TestClient]:
    app = create_app(settings)
    app.dependency_overrides[get_session] = lambda: db
    # https: el cliente, como un navegador, no devuelve cookies Secure por HTTP.
    with TestClient(app, base_url="https://testserver", headers=SAME_ORIGIN_HEADERS) as test:
        yield test


def _cuenta(
    db: Session,
    email: str = "ana@example.com",
    *,
    password_hash: str | None = _HASH,
    role: str = "owner",
    **cambios: typing.Any,
) -> User:
    """Una persona con contraseña, su organización y su membresía."""
    user = User(
        email=email,
        password_hash=password_hash,
        full_name="Ana Restrepo",
        terms_version=LEGAL_VERSION,
        privacy_version=LEGAL_VERSION,
        consented_at=datetime.datetime.now(datetime.UTC),
        **cambios,
    )
    db.add(user)
    db.flush()
    organization_id = uuid.uuid7()
    set_tenant(db, TenantContext(organization_id=organization_id, user_id=user.id))
    db.add(Organization(id=organization_id, name="Restrepo Abogados"))
    db.flush()
    db.add(Membership(organization_id=organization_id, user_id=user.id, role=role))
    db.flush()
    set_tenant(db, TenantContext())
    return user


def _ingresar(
    client: TestClient, email: str = "ana@example.com", clave: str = _CLAVE
) -> httpx2.Response:
    return client.post(_INGRESO, json={"email": email, "password": clave})


def _cookies(set_cookie: list[str]) -> dict[str, SimpleCookie]:
    cookies: dict[str, SimpleCookie] = {}
    for header in set_cookie:
        cookie = SimpleCookie()
        cookie.load(header)
        [name] = cookie.keys()
        cookies[name] = cookie
    return cookies


def _auditoria(db: Session, action: str) -> list[AuditLog]:
    # La auditoría solo se lee con el contexto de su organización; el dueño del esquema la ve
    # completa, pero aquí se usa la sesión de la aplicación con el contexto fijado.
    return list(db.scalars(select(AuditLog).where(AuditLog.action == action)))


def _familias(db: Session, user: User) -> list[RefreshToken]:
    return list(db.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id)))


# --- Ingreso válido (CA-HU-007-01) --------------------------------------------------------


def test_con_datos_validos_entra_con_cookies_httponly_secure_y_strict(
    client: TestClient, db: Session
) -> None:
    _cuenta(db)

    response = _ingresar(client)

    assert response.status_code == 204
    assert response.headers["cache-control"] == "no-store"
    cookies = _cookies(response.headers.get_list("set-cookie"))
    assert set(cookies) == {ACCESS_COOKIE, REFRESH_COOKIE}
    for name, cookie in cookies.items():
        morsel = cookie[name]
        assert morsel["httponly"] is True
        assert morsel["secure"] is True
        assert morsel["samesite"].lower() == "strict"
        # Sin dominio: la cookie es solo de aletheia.sbs, nunca de sus subdominios.
        assert morsel["domain"] == ""
    acceso = cookies[ACCESS_COOKIE][ACCESS_COOKIE]
    renovacion = cookies[REFRESH_COOKIE][REFRESH_COOKIE]
    assert acceso["path"] == "/"
    assert acceso["max-age"] == "600"
    assert renovacion["path"] == REFRESH_COOKIE_PATH
    assert int(renovacion["max-age"]) == pytest.approx(SESSION_LIFETIME.total_seconds(), abs=5)


def test_la_base_guarda_el_hash_de_la_renovacion_y_nunca_el_token(
    client: TestClient, db: Session
) -> None:
    user = _cuenta(db)

    response = _ingresar(client)

    token = response.cookies[REFRESH_COOKIE]
    [guardado] = _familias(db, user)
    assert guardado.token_hash == hashlib.sha256(token.encode()).digest()
    assert guardado.token_hash == refresh_token_hash(token)
    assert token.encode() not in guardado.token_hash
    assert guardado.used_at is None
    assert guardado.revoked_at is None
    vida = guardado.expires_at - guardado.created_at
    assert vida == pytest.approx(SESSION_LIFETIME, abs=datetime.timedelta(seconds=5))


def test_el_correo_no_distingue_mayusculas(client: TestClient, db: Session) -> None:
    _cuenta(db)

    assert _ingresar(client, email="  ANA@Example.com ").status_code == 204


def test_un_correo_sin_verificar_tambien_entra(client: TestClient, db: Session) -> None:
    # La verificación limita lo que puede hacer (CA-HU-006-02, HU-015), no el ingreso.
    _cuenta(db, email_verified_at=None)

    assert _ingresar(client).status_code == 204


def test_cada_ingreso_abre_una_familia_nueva(client: TestClient, db: Session) -> None:
    user = _cuenta(db)

    _ingresar(client)
    _ingresar(client)

    assert len({token.family_id for token in _familias(db, user)}) == 2


def test_el_ingreso_queda_en_la_auditoria_de_su_organizacion(
    client: TestClient, db: Session
) -> None:
    user = _cuenta(db)
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    assert membership is None  # Sin contexto, Row-Level Security no la deja ver.

    _ingresar(client, clave="otra clave equivocada")
    _ingresar(client)

    set_tenant(db, TenantContext(user_id=user.id))
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    assert membership is not None
    set_tenant(db, TenantContext(organization_id=membership.organization_id, user_id=user.id))
    [fallido] = _auditoria(db, "login_failed")
    [ingreso] = _auditoria(db, "login")
    for evento in (fallido, ingreso):
        assert evento.organization_id == membership.organization_id
        assert evento.actor_user_id == user.id
        assert evento.ip is None  # El cliente de pruebas no tiene una IP real.
        assert evento.user_agent == "testclient"


def test_un_hash_con_parametros_viejos_se_rehace_al_ingresar(
    client: TestClient, db: Session
) -> None:
    viejo = PasswordHasher(time_cost=1, memory_cost=8 * 1024, parallelism=1, type=Type.ID)
    user = _cuenta(db, password_hash=viejo.hash(_CLAVE))

    assert _ingresar(client).status_code == 204

    db.refresh(user)
    assert user.password_hash is not None
    assert "m=19456,t=2,p=1" in user.password_hash
    assert verify_password(user.password_hash, _CLAVE)


# --- Datos inválidos (CA-HU-007-02, RN-026) -----------------------------------------------


def test_contrasena_equivocada_y_correo_inexistente_reciben_lo_mismo(
    client: TestClient, db: Session
) -> None:
    _cuenta(db)
    _cuenta(db, email="solo-google@example.com", password_hash=None)

    respuestas = [
        _ingresar(client, clave="una contraseña equivocada"),
        _ingresar(client, email="nadie@example.com"),
        _ingresar(client, email="solo-google@example.com"),
    ]

    for response in respuestas:
        assert response.status_code == 401
        assert response.headers["content-type"] == PROBLEM_JSON
        assert response.headers["www-authenticate"] == 'Cookie realm="aletheia"'
        assert response.headers["cache-control"] == "no-store"
        assert "set-cookie" not in response.headers
    cuerpos = [{k: v for k, v in r.json().items() if k != "request_id"} for r in respuestas]
    assert cuerpos[0]["detail"] == _MENSAJE_GENERICO
    assert cuerpos[0] == cuerpos[1] == cuerpos[2]


def test_un_correo_inexistente_tambien_pasa_por_argon2id(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core import passwords

    llamadas: list[str] = []
    original = passwords.verify_password

    def contar(password_hash: str, password: str) -> bool:
        llamadas.append(password_hash)
        return original(password_hash, password)

    monkeypatch.setattr(passwords, "verify_password", contar)

    _ingresar(client, email="nadie@example.com")

    # El señuelo cuesta lo mismo que un hash real: el tiempo no revela si la cuenta existe.
    [hash_usado] = llamadas
    assert hash_usado.startswith("$argon2id$v=19$m=19456,t=2,p=1$")


def test_un_intento_contra_un_correo_sin_cuenta_no_lo_lee_ninguna_organizacion(
    client: TestClient, db: Session
) -> None:
    ana = _cuenta(db)
    _ingresar(client, email="nadie@example.com")

    # El evento se guarda sin organización: ni siquiera otra organización cualquiera lo ve.
    set_tenant(db, TenantContext(user_id=ana.id))
    membership = db.scalar(select(Membership).where(Membership.user_id == ana.id))
    assert membership is not None
    set_tenant(db, TenantContext(organization_id=membership.organization_id, user_id=ana.id))
    assert _auditoria(db, "login_failed") == []


def test_la_cuenta_bloqueada_con_la_clave_correcta_recibe_403(
    client: TestClient, db: Session
) -> None:
    _cuenta(db, status="blocked")

    correcta = _ingresar(client)
    equivocada = _ingresar(client, clave="una contraseña equivocada")

    assert correcta.status_code == 403
    assert "bloqueada" in correcta.json()["detail"]
    assert "set-cookie" not in correcta.headers
    # Sin la clave correcta no se sabe nada del bloqueo.
    assert equivocada.status_code == 401
    assert equivocada.json()["detail"] == _MENSAJE_GENERICO


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"email": "no-es-un-correo", "password": _CLAVE},
        {"email": "ana@example.com", "password": ""},
        {"email": "ana@example.com", "password": "x" * 513},
        {"email": "ana@example.com", "password": _CLAVE, "recordarme": True},
    ],
)
def test_rechaza_datos_mal_formados(client: TestClient, cuerpo: dict[str, typing.Any]) -> None:
    response = client.post(_INGRESO, json=cuerpo)

    assert response.status_code == 422
    # El valor recibido nunca vuelve en la respuesta.
    assert _CLAVE not in response.text


# --- Límite de intentos (CA-HU-007-03) ---------------------------------------------------


def test_al_sexto_intento_fallido_la_cuenta_responde_429(client: TestClient, db: Session) -> None:
    _cuenta(db)

    fallidos = [_ingresar(client, clave=f"clave equivocada {n}") for n in range(5)]
    sexto = _ingresar(client, clave="clave equivocada 6")
    con_la_correcta = _ingresar(client)

    assert {r.status_code for r in fallidos} == {401}
    for response in (sexto, con_la_correcta):
        assert response.status_code == 429
        assert int(response.headers["retry-after"]) > 0
        assert "set-cookie" not in response.headers


def test_un_correo_inexistente_se_limita_igual_que_uno_real(client: TestClient) -> None:
    respuestas = [_ingresar(client, email="nadie@example.com") for _ in range(6)]

    assert [r.status_code for r in respuestas] == [401] * 5 + [429]


def test_un_ingreso_correcto_devuelve_los_intentos_a_la_cuenta(
    client: TestClient, db: Session
) -> None:
    _cuenta(db)

    for n in range(4):
        _ingresar(client, clave=f"clave equivocada {n}")
    assert _ingresar(client).status_code == 204

    # Después del ingreso correcto la cuenta vuelve a tener sus cinco intentos.
    respuestas = [_ingresar(client, clave=f"otra equivocada {n}") for n in range(5)]
    assert {r.status_code for r in respuestas} == {401}


def test_veinte_fallos_desde_una_ip_frenan_cualquier_cuenta(
    client: TestClient, db: Session
) -> None:
    _cuenta(db)

    for n in range(20):
        _ingresar(client, email=f"persona{n}@example.com")
    response = _ingresar(client)

    assert response.status_code == 429


def test_los_intentos_correctos_no_cuentan_para_el_limite(client: TestClient, db: Session) -> None:
    _cuenta(db)

    respuestas = [_ingresar(client) for _ in range(7)]

    assert {r.status_code for r in respuestas} == {204}
    assert db.scalar(select(RateLimitEvent.id).limit(1)) is None


# --- La sesión en cada petición (API-014) ------------------------------------------------


def test_sin_sesion_el_perfil_responde_401(client: TestClient) -> None:
    response = client.get(_PERFIL)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == 'Cookie realm="aletheia"'
    assert response.json()["detail"] == "Su sesión terminó. Ingrese de nuevo."


def test_con_sesion_el_perfil_trae_la_persona_su_organizacion_y_su_rol(
    client: TestClient, db: Session
) -> None:
    user = _cuenta(db)
    _ingresar(client)

    response = client.get(_PERFIL)

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    perfil = response.json()
    assert perfil["id"] == str(user.id)
    assert perfil["full_name"] == "Ana Restrepo"
    assert perfil["email"] == "ana@example.com"
    assert perfil["email_verified"] is False
    assert perfil["organization"]["name"] == "Restrepo Abogados"
    assert perfil["organization"]["role"] == "owner"


def test_revocar_la_familia_corta_el_acceso_de_inmediato(client: TestClient, db: Session) -> None:
    user = _cuenta(db)
    _ingresar(client)
    assert client.get(_PERFIL).status_code == 200

    # El token de acceso sigue vigente nueve minutos más, pero su sesión ya no existe.
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .values(revoked_at=datetime.datetime.now(datetime.UTC))
    )

    assert client.get(_PERFIL).status_code == 401


def test_bloquear_la_cuenta_corta_el_acceso_de_inmediato(client: TestClient, db: Session) -> None:
    user = _cuenta(db)
    _ingresar(client)

    db.execute(update(User).where(User.id == user.id).values(status="blocked"))

    assert client.get(_PERFIL).status_code == 401


def test_una_sesion_vencida_ya_no_sirve(client: TestClient, db: Session) -> None:
    user = _cuenta(db)
    _ingresar(client)

    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .values(expires_at=datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=1))
    )

    assert client.get(_PERFIL).status_code == 401


def test_un_acceso_alterado_o_ajeno_no_sirve(client: TestClient, db: Session) -> None:
    ana = _cuenta(db)
    otra = _cuenta(db, email="otra@example.com")
    _ingresar(client, email="otra@example.com")
    [familia_de_otra] = _familias(db, otra)
    minutos = datetime.timedelta(minutes=10)

    alterado = client.cookies[ACCESS_COOKIE][:-2] + "xx"
    # Firmado bien, pero con la sesión de otra persona: la familia no es de Ana.
    con_sesion_ajena = issue_access_token(
        TEST_SIGNING_KEY, ana.id, familia_de_otra.family_id, minutos
    )
    # Una sesión que nunca existió.
    inventado = issue_access_token(TEST_SIGNING_KEY, ana.id, uuid.uuid7(), minutos)
    vencido = issue_access_token(
        TEST_SIGNING_KEY,
        otra.id,
        familia_de_otra.family_id,
        minutos,
        now=datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=11),
    )

    for token in (alterado, con_sesion_ajena, inventado, vencido, "", "x" * 2000):
        client.cookies.clear()
        client.cookies.set(ACCESS_COOKIE, token)
        assert client.get(_PERFIL).status_code == 401


def test_una_persona_sin_organizacion_ve_su_perfil_sin_ella(
    client: TestClient, db: Session
) -> None:
    user = User(
        email="retirada@example.com",
        password_hash=_HASH,
        full_name="Persona retirada",
        terms_version=LEGAL_VERSION,
        privacy_version=LEGAL_VERSION,
        consented_at=datetime.datetime.now(datetime.UTC),
    )
    db.add(user)
    db.flush()

    assert _ingresar(client, email="retirada@example.com").status_code == 204
    perfil = client.get(_PERFIL).json()

    assert perfil["organization"] is None


def test_los_roles_del_perfil_son_los_de_la_base() -> None:
    assert typing.get_args(MemberRole) == MEMBER_ROLES


# --- Registros sin secretos --------------------------------------------------------------


def test_un_ingreso_no_deja_la_clave_ni_los_tokens_en_los_registros(
    client: TestClient, db: Session, caplog: pytest.LogCaptureFixture
) -> None:
    _cuenta(db)
    caplog.set_level(logging.DEBUG)

    response = _ingresar(client)
    client.get(_PERFIL)

    registros = "\n".join(f"{r.getMessage()} {r.__dict__}" for r in caplog.records)
    assert _CLAVE not in registros
    assert response.cookies[ACCESS_COOKIE] not in registros
    assert response.cookies[REFRESH_COOKIE] not in registros
