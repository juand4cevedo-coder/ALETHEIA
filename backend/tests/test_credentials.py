"""Pruebas de recuperar y cambiar la contraseña (HU-010, CA-HU-010-01 y CA-HU-010-02)."""

import datetime
import uuid
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.cookies import ACCESS_COOKIE
from app.api.deps import get_session
from app.core.config import Settings
from app.core.errors import PROBLEM_JSON
from app.core.legal import LEGAL_VERSION
from app.core.passwords import hash_password, verify_password
from app.core.tokens import LinkPurpose, issue_link
from app.db.tenancy import TenantContext, set_tenant
from app.main import create_app
from app.models import AuditLog, Job, Membership, Organization, RefreshToken, User
from app.services import account_emails
from app.services.credentials import RESET_LINK_LIFETIME, recovery_state
from tests.conftest import SAME_ORIGIN_HEADERS, TEST_SIGNING_KEY

_OLVIDO = "/api/v1/auth/password/forgot"
_RESTABLECER = "/api/v1/auth/password/reset"
_CAMBIAR = "/api/v1/me/password"
_INGRESO = "/api/v1/auth/login"
_PERFIL = "/api/v1/me"
_EMAIL = "ana@example.com"
_CLAVE = "una frase larga y fácil de recordar"
_NUEVA = "otra frase distinta y también larga"
_HASH = hash_password(_CLAVE)
_RESPUESTA_OLVIDO = (
    "Si el correo está registrado, recibirá un enlace para crear una contraseña nueva."
)

type NuevoCliente = Callable[[], TestClient]


@pytest.fixture
def app(settings: Settings, db: Session) -> FastAPI:
    application = create_app(settings)
    application.dependency_overrides[get_session] = lambda: db
    return application


@pytest.fixture
def dispositivo(app: FastAPI) -> Iterator[NuevoCliente]:
    abiertos: list[TestClient] = []

    def nuevo() -> TestClient:
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


def _cuenta(db: Session, **cambios: Any) -> User:
    datos: dict[str, Any] = {
        "email": _EMAIL,
        "password_hash": _HASH,
        "full_name": "Ana Restrepo",
        "terms_version": LEGAL_VERSION,
        "privacy_version": LEGAL_VERSION,
        "consented_at": datetime.datetime.now(datetime.UTC),
    }
    user = User(**(datos | cambios))
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


def _ingresar(client: TestClient, clave: str = _CLAVE) -> int:
    return client.post(_INGRESO, json={"email": _EMAIL, "password": clave}).status_code


def _correos(db: Session, template: str) -> list[dict[str, Any]]:
    statement = select(Job).where(Job.kind == "email_send")
    return [job.payload for job in db.scalars(statement) if job.payload["template"] == template]


def _enlace(user: User, *, lifetime: datetime.timedelta = RESET_LINK_LIFETIME) -> str:
    return issue_link(
        TEST_SIGNING_KEY, LinkPurpose.ACCOUNT_RECOVERY, user.id, recovery_state(user), lifetime
    )


def _auditoria(db: Session, user: User, action: str) -> list[AuditLog]:
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    assert membership is not None
    set_tenant(db, TenantContext(organization_id=membership.organization_id, user_id=user.id))
    statement = select(AuditLog).where(AuditLog.action == action)
    return list(db.scalars(statement))


def _vivos(db: Session, user: User) -> list[RefreshToken]:
    statement = (
        select(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .execution_options(populate_existing=True)
    )
    return list(db.scalars(statement))


def _recargar(db: Session, user: User) -> User:
    db.refresh(user)
    return user


# --- Pedir el enlace (API-011, CA-HU-010-02) -----------------------------------------------


def test_pedir_el_enlace_responde_igual_exista_o_no_la_cuenta(
    client: TestClient, db: Session
) -> None:
    _cuenta(db)

    existente = client.post(_OLVIDO, json={"email": "ANA@example.com"})
    inexistente = client.post(_OLVIDO, json={"email": "nadie@example.com"})

    for response in (existente, inexistente):
        assert response.status_code == 202
        assert response.headers["cache-control"] == "no-store"
        assert response.json() == {"detail": _RESPUESTA_OLVIDO}
    # Solo la cuenta real recibe el correo, y la tarea lleva su identificador, nunca el enlace.
    [payload] = _correos(db, "password_reset")
    assert set(payload) == {"template", "user_id"}


def test_una_cuenta_bloqueada_no_recibe_el_enlace(client: TestClient, db: Session) -> None:
    _cuenta(db, status="blocked")

    assert client.post(_OLVIDO, json={"email": _EMAIL}).status_code == 202
    assert _correos(db, "password_reset") == []


def test_pedir_el_enlace_tiene_tope_por_correo_aunque_no_exista(client: TestClient) -> None:
    for _ in range(5):
        assert client.post(_OLVIDO, json={"email": "nadie@example.com"}).status_code == 202

    response = client.post(_OLVIDO, json={"email": "nadie@example.com"})

    assert response.status_code == 429
    assert "retry-after" in response.headers


def test_pedir_el_enlace_tiene_tope_por_ip(client: TestClient) -> None:
    for numero in range(20):
        client.post(_OLVIDO, json={"email": f"persona{numero}@example.com"})

    assert client.post(_OLVIDO, json={"email": "otra@example.com"}).status_code == 429


@pytest.mark.parametrize("cuerpo", [{}, {"email": "no-es-correo"}, {"email": _EMAIL, "x": 1}])
def test_pedir_el_enlace_rechaza_datos_mal_formados(
    client: TestClient, cuerpo: dict[str, Any]
) -> None:
    response = client.post(_OLVIDO, json=cuerpo)

    assert response.status_code == 422
    assert response.headers["content-type"] == PROBLEM_JSON


# --- El correo con el enlace ---------------------------------------------------------------


def test_el_correo_lleva_el_enlace_en_el_fragmento_y_vence_en_una_hora(
    db: Session, settings: Settings
) -> None:
    user = _cuenta(db)

    email = account_emails.password_reset_email(db, {"user_id": str(user.id)}, settings)

    assert email is not None
    assert email.to == _EMAIL
    enlace = next(linea for linea in email.text.splitlines() if "#t=" in linea)
    assert enlace.startswith("http://localhost:5173/restablecer-contrasena#t=")
    assert "60 minutos" in email.text
    assert email.html is not None
    assert "Crear una contraseña nueva" in email.html


def test_una_cuenta_bloqueada_no_recibe_el_correo_aunque_ya_estuviera_en_cola(
    db: Session, settings: Settings
) -> None:
    user = _cuenta(db, status="blocked")

    assert account_emails.password_reset_email(db, {"user_id": str(user.id)}, settings) is None


def test_el_aviso_de_cambio_escapa_el_nombre_y_lleva_a_recuperar(
    db: Session, settings: Settings
) -> None:
    user = _cuenta(db, full_name='<script>alert("x")</script>')

    email = account_emails.password_changed_email(db, {"user_id": str(user.id)}, settings)

    assert email is not None
    assert email.html is not None
    assert "<script>" not in email.html
    assert "http://localhost:5173/recuperar" in email.text


# --- Restablecer con el enlace (API-012, CA-HU-010-01) --------------------------------------


def test_el_enlace_cambia_la_contrasena_y_cierra_todas_las_sesiones(
    dispositivo: NuevoCliente, db: Session
) -> None:
    user = _cuenta(db)
    portatil = dispositivo()
    celular = dispositivo()
    assert _ingresar(portatil) == 204
    assert _ingresar(celular) == 204

    response = dispositivo().post(
        _RESTABLECER,
        json={"token": _enlace(user), "password": _NUEVA},
        headers={"User-Agent": "Navegador de Ana"},
    )

    assert response.status_code == 204
    assert response.headers["cache-control"] == "no-store"
    assert verify_password(_recargar(db, user).password_hash or "", _NUEVA)
    assert _vivos(db, user) == []
    for equipo in (portatil, celular):
        assert equipo.get(_PERFIL).status_code == 401
    [evento] = _auditoria(db, user, "password_reset")
    assert evento.user_agent == "Navegador de Ana"
    assert len(_correos(db, "password_changed")) == 1
    # La contraseña anterior ya no abre nada; la nueva sí.
    assert _ingresar(dispositivo()) == 401
    assert _ingresar(dispositivo(), _NUEVA) == 204


def test_el_enlace_sirve_una_sola_vez(client: TestClient, db: Session) -> None:
    user = _cuenta(db)
    enlace = _enlace(user)
    assert client.post(_RESTABLECER, json={"token": enlace, "password": _NUEVA}).status_code == 204

    response = client.post(_RESTABLECER, json={"token": enlace, "password": "una tercera clave"})

    assert response.status_code == 400
    assert response.json()["detail"] == "El enlace no es válido o ya venció. Pida uno nuevo."
    assert verify_password(_recargar(db, user).password_hash or "", _NUEVA)


def test_un_enlace_de_antes_de_otro_cambio_ya_no_sirve(client: TestClient, db: Session) -> None:
    # Dos correos pedidos seguidos: usar el segundo deja sin valor el primero.
    user = _cuenta(db)
    primero = _enlace(user)
    segundo = _enlace(user)
    assert client.post(_RESTABLECER, json={"token": segundo, "password": _NUEVA}).status_code == 204
    _recargar(db, user)

    response = client.post(_RESTABLECER, json={"token": primero, "password": "una tercera clave"})

    assert response.status_code == 400
    assert verify_password(user.password_hash or "", _NUEVA)


def test_el_enlace_no_lleva_nada_derivado_de_la_contrasena(db: Session) -> None:
    # El sello depende del stamp y del correo: cambiar solo el hash no lo altera, y cada cambio
    # de credenciales sí lo hace.
    user = _cuenta(db)
    antes = recovery_state(user)
    user.password_hash = hash_password("x" * 20)
    assert recovery_state(user) == antes
    assert user.password_hash not in antes


def test_todo_enlace_invalido_recibe_el_mismo_mensaje(client: TestClient, db: Session) -> None:
    user = _cuenta(db)
    vencido = _enlace(user, lifetime=datetime.timedelta(seconds=-1))
    de_verificacion = issue_link(
        TEST_SIGNING_KEY,
        LinkPurpose.EMAIL_VERIFICATION,
        user.id,
        recovery_state(user),
        RESET_LINK_LIFETIME,
    )
    de_otra_cuenta = issue_link(
        TEST_SIGNING_KEY,
        LinkPurpose.ACCOUNT_RECOVERY,
        uuid.uuid7(),
        recovery_state(user),
        RESET_LINK_LIFETIME,
    )
    alterado = _enlace(user)[:-2] + "xx"

    for token in (vencido, de_verificacion, de_otra_cuenta, alterado):
        response = client.post(_RESTABLECER, json={"token": token, "password": _NUEVA})
        assert response.status_code == 400
        assert response.json()["detail"] == "El enlace no es válido o ya venció. Pida uno nuevo."
    assert verify_password(_recargar(db, user).password_hash or "", _CLAVE)


def test_una_cuenta_bloqueada_no_restablece_con_un_enlace_vigente(
    client: TestClient, db: Session
) -> None:
    user = _cuenta(db)
    enlace = _enlace(user)
    db.execute(update(User).where(User.id == user.id).values(status="blocked"))

    assert client.post(_RESTABLECER, json={"token": enlace, "password": _NUEVA}).status_code == 400


def test_restablecer_verifica_el_correo(client: TestClient, db: Session) -> None:
    # Abrir el enlace demuestra que la persona controla el correo.
    user = _cuenta(db)
    assert user.email_verified_at is None

    client.post(_RESTABLECER, json={"token": _enlace(user), "password": _NUEVA})

    assert _recargar(db, user).email_verified_at is not None


def test_restablecer_devuelve_los_intentos_de_ingreso(client: TestClient, db: Session) -> None:
    user = _cuenta(db)
    for _ in range(5):
        _ingresar(client, "clave equivocada")
    assert _ingresar(client) == 429

    client.post(_RESTABLECER, json={"token": _enlace(user), "password": _NUEVA})

    assert _ingresar(client, _NUEVA) == 204


@pytest.mark.parametrize("clave", ["corta", "x" * 129])
def test_restablecer_exige_una_contrasena_de_largo_valido(
    client: TestClient, db: Session, clave: str
) -> None:
    user = _cuenta(db)

    response = client.post(_RESTABLECER, json={"token": _enlace(user), "password": clave})

    assert response.status_code == 422


def test_restablecer_tiene_tope_por_ip(client: TestClient) -> None:
    for _ in range(20):
        client.post(_RESTABLECER, json={"token": "inventado", "password": _NUEVA})

    assert client.post(_RESTABLECER, json={"token": "x", "password": _NUEVA}).status_code == 429


# --- Cambiar la contraseña con sesión (API-013) --------------------------------------------


def test_cambiar_la_contrasena_conserva_esta_sesion_y_cierra_las_demas(
    dispositivo: NuevoCliente, db: Session
) -> None:
    user = _cuenta(db)
    portatil = dispositivo()
    celular = dispositivo()
    _ingresar(portatil)
    _ingresar(celular)

    response = portatil.put(_CAMBIAR, json={"current_password": _CLAVE, "new_password": _NUEVA})

    assert response.status_code == 204
    assert portatil.get(_PERFIL).status_code == 200
    assert celular.get(_PERFIL).status_code == 401
    assert verify_password(_recargar(db, user).password_hash or "", _NUEVA)
    assert len(_auditoria(db, user, "password_changed")) == 1
    assert len(_correos(db, "password_changed")) == 1


def test_con_la_contrasena_actual_equivocada_no_cambia_nada(
    client: TestClient, db: Session
) -> None:
    user = _cuenta(db)
    _ingresar(client)

    response = client.put(_CAMBIAR, json={"current_password": "otra", "new_password": _NUEVA})

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "La contraseña actual no coincide. Revísela e inténtelo de nuevo."
    )
    assert verify_password(_recargar(db, user).password_hash or "", _CLAVE)


def test_una_sesion_robada_no_sirve_para_adivinar_la_contrasena(
    client: TestClient, db: Session
) -> None:
    _cuenta(db)
    _ingresar(client)
    for _ in range(5):
        client.put(_CAMBIAR, json={"current_password": "adivinanza", "new_password": _NUEVA})

    response = client.put(_CAMBIAR, json={"current_password": _CLAVE, "new_password": _NUEVA})

    assert response.status_code == 429


def test_la_contrasena_nueva_debe_ser_distinta(client: TestClient, db: Session) -> None:
    _cuenta(db)
    _ingresar(client)

    response = client.put(_CAMBIAR, json={"current_password": _CLAVE, "new_password": _CLAVE})

    assert response.status_code == 400
    assert response.json()["detail"] == "La contraseña nueva debe ser distinta de la actual."


def test_cambiar_la_contrasena_exige_sesion(client: TestClient) -> None:
    response = client.put(_CAMBIAR, json={"current_password": _CLAVE, "new_password": _NUEVA})

    assert response.status_code == 401


def test_cambiar_la_contrasena_exige_los_textos_vigentes(client: TestClient, db: Session) -> None:
    _cuenta(db, terms_version="2026-01-01", privacy_version="2026-01-01")
    _ingresar(client)

    response = client.put(_CAMBIAR, json={"current_password": _CLAVE, "new_password": _NUEVA})

    assert response.status_code == 403


def test_cambiar_la_contrasena_exige_el_encabezado_propio(client: TestClient, db: Session) -> None:
    _cuenta(db)
    _ingresar(client)

    response = client.put(
        _CAMBIAR,
        json={"current_password": _CLAVE, "new_password": _NUEVA},
        headers={"X-Aletheia-Request": ""},
    )

    assert response.status_code == 403
    assert client.cookies.get(ACCESS_COOKIE)
