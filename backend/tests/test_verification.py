"""Pruebas de los correos de la cuenta: verificación, aviso de registro repetido y reenvío
(HU-006)."""

import datetime
import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters.email import SmtpEmailSender
from app.api.deps import get_session
from app.core.config import Settings, SigningKeyMissingError
from app.core.errors import PROBLEM_JSON
from app.core.legal import LEGAL_VERSION
from app.core.tokens import LinkPurpose, issue_link, read_link, state_matches
from app.db.tenancy import TenantContext, set_tenant
from app.main import create_app
from app.models import AuditLog, Job, Membership, User
from app.services import account_emails
from app.services.jobs import PermanentJobError
from app.services.verification import verification_link, verification_state
from tests.conftest import SAME_ORIGIN_HEADERS, TEST_SIGNING_KEY
from tests.test_email import _delivered, _recipient

_REGISTRO = "/api/v1/auth/register"
_REENVIO = "/api/v1/auth/verify-email/resend"


@pytest.fixture
def client(settings: Settings, db: Session) -> Iterator[TestClient]:
    app = create_app(settings)
    app.dependency_overrides[get_session] = lambda: db
    with TestClient(app, headers=SAME_ORIGIN_HEADERS) as test_client:
        yield test_client


def _registro(**cambios: Any) -> dict[str, Any]:
    datos: dict[str, Any] = {
        "account_type": "individual",
        "full_name": "Ana Restrepo",
        "email": "ana@example.com",
        "password": "una frase larga y fácil de recordar",
        "legal_version": LEGAL_VERSION,
        "accepts_legal_terms": True,
    }
    datos.update(cambios)
    return datos


def _correos(db: Session) -> list[dict[str, Any]]:
    return [job.payload for job in db.scalars(select(Job).where(Job.kind == "email_send"))]


def _persona(db: Session, nombre: str = "Ana <b>Restrepo</b>", **cambios: Any) -> User:
    user = User(
        email=cambios.pop("email", _recipient()),
        password_hash=None,
        full_name=nombre,
        terms_version=LEGAL_VERSION,
        privacy_version=LEGAL_VERSION,
        consented_at=datetime.datetime.now(datetime.UTC),
        **cambios,
    )
    db.add(user)
    db.flush()
    return user


# --- Al registrarse -----------------------------------------------------------------------


def test_una_cuenta_nueva_encola_su_verificacion_solo_con_identificadores(
    client: TestClient, db: Session
) -> None:
    client.post(_REGISTRO, json=_registro())

    [user] = db.scalars(select(User)).all()
    # El payload no lleva el correo ni el nombre: la plantilla los lee al enviar.
    assert _correos(db) == [{"template": "email_verification", "user_id": str(user.id)}]


def test_un_correo_registrado_recibe_un_aviso_con_tope(client: TestClient, db: Session) -> None:
    client.post(_REGISTRO, json=_registro())
    [user] = db.scalars(select(User)).all()

    respuestas = [client.post(_REGISTRO, json=_registro()) for _ in range(7)]

    # Siempre la misma respuesta, pero solo cinco avisos cada 15 minutos para esa dirección.
    assert {respuesta.status_code for respuesta in respuestas} == {202}
    avisos = [c for c in _correos(db) if c["template"] == "account_exists"]
    assert avisos == [{"template": "account_exists", "user_id": str(user.id)}] * 5


# --- Plantillas ----------------------------------------------------------------------------


def test_el_correo_de_verificacion_lleva_un_enlace_valido_en_el_fragmento(
    db: Session, settings: Settings
) -> None:
    user = _persona(db)

    email = account_emails.verification_email(db, {"user_id": str(user.id)}, settings)

    assert email is not None
    assert email.to == user.email
    enlace = next(linea for linea in email.text.splitlines() if "#t=" in linea)
    base, token = enlace.split("#t=")
    assert base == "http://localhost:5173/verificar-correo"
    claims = read_link(TEST_SIGNING_KEY, LinkPurpose.EMAIL_VERIFICATION, token)
    assert claims.subject == user.id
    # El sello es del correo sin distinguir mayúsculas, como se compara al verificar.
    assert state_matches(
        TEST_SIGNING_KEY,
        LinkPurpose.EMAIL_VERIFICATION,
        claims,
        verification_state(user.email.upper()),
    )


def test_el_html_escapa_el_nombre(db: Session, settings: Settings) -> None:
    user = _persona(db, nombre='<script>alert("x")</script>')

    email = account_emails.verification_email(db, {"user_id": str(user.id)}, settings)

    assert email is not None
    assert email.html is not None
    assert "<script>" not in email.html
    assert "&lt;script&gt;" in email.html


def test_una_cuenta_ya_verificada_no_recibe_el_correo(db: Session, settings: Settings) -> None:
    user = _persona(db, email_verified_at=datetime.datetime.now(datetime.UTC))

    assert account_emails.verification_email(db, {"user_id": str(user.id)}, settings) is None


def test_una_cuenta_que_ya_no_existe_no_recibe_correo(db: Session, settings: Settings) -> None:
    payload = {"user_id": str(uuid.uuid7())}

    assert account_emails.verification_email(db, payload, settings) is None
    assert account_emails.account_exists_email(db, payload, settings) is None


def test_un_payload_sin_user_id_valido_entierra_la_tarea(db: Session, settings: Settings) -> None:
    with pytest.raises(PermanentJobError):
        account_emails.verification_email(db, {"user_id": "no-es-un-uuid"}, settings)


def test_el_aviso_lleva_a_ingresar(db: Session, settings: Settings) -> None:
    user = _persona(db)

    email = account_emails.account_exists_email(db, {"user_id": str(user.id)}, settings)

    assert email is not None
    assert "http://localhost:5173/ingresar" in email.text
    assert "#t=" not in email.text


def test_el_correo_de_verificacion_llega_a_mailpit(db: Session, settings: Settings) -> None:
    user = _persona(db, nombre="Ana Restrepo")
    email = account_emails.verification_email(db, {"user_id": str(user.id)}, settings)
    assert email is not None

    SmtpEmailSender(settings.smtp_host, settings.smtp_port).send(email)

    recibido = _delivered(user.email)
    assert recibido["Subject"] == "Verifique su correo en ALETHEIA"
    assert "/verificar-correo#t=" in recibido["Text"]
    assert "Verificar mi correo" in recibido["HTML"]


def test_sin_clave_de_firma_el_error_lo_dice(settings: Settings) -> None:
    with pytest.raises(SigningKeyMissingError, match="ALETHEIA_TOKEN_SIGNING_KEY"):
        settings.model_copy(update={"token_signing_key": None}).signing_key()


# --- Reenvío -------------------------------------------------------------------------------


def test_el_reenvio_responde_igual_exista_o_no_la_cuenta(client: TestClient, db: Session) -> None:
    pendiente = _persona(db, email="pendiente@example.com")
    _persona(
        db, email="verificada@example.com", email_verified_at=datetime.datetime.now(datetime.UTC)
    )

    respuestas = [
        client.post(_REENVIO, json={"email": correo})
        for correo in ("nadie@example.com", "PENDIENTE@example.com", "verificada@example.com")
    ]

    assert {r.status_code for r in respuestas} == {202}
    assert len({r.text for r in respuestas}) == 1
    assert respuestas[0].headers["cache-control"] == "no-store"
    # Solo la cuenta pendiente recibe un enlace nuevo.
    assert _correos(db) == [{"template": "email_verification", "user_id": str(pendiente.id)}]


def test_el_reenvio_tiene_tope_por_correo(client: TestClient) -> None:
    for _ in range(5):
        assert client.post(_REENVIO, json={"email": "ana@example.com"}).status_code == 202

    respuesta = client.post(_REENVIO, json={"email": "ana@example.com"})
    assert respuesta.status_code == 429
    assert int(respuesta.headers["retry-after"]) > 0


def test_el_reenvio_tiene_tope_por_ip(client: TestClient) -> None:
    for numero in range(20):
        correo = f"persona{numero}@example.com"
        assert client.post(_REENVIO, json={"email": correo}).status_code == 202

    assert client.post(_REENVIO, json={"email": "otra@example.com"}).status_code == 429


@pytest.mark.parametrize("cuerpo", [{"email": "no-es-un-correo"}, {"email": "a@b.co", "extra": 1}])
def test_el_reenvio_rechaza_datos_invalidos(client: TestClient, cuerpo: dict[str, Any]) -> None:
    assert client.post(_REENVIO, json=cuerpo).status_code == 422


# --- Verificación (API-004) ----------------------------------------------------------------

_VERIFICAR = "/api/v1/auth/verify-email"


def _cuenta_registrada(client: TestClient, db: Session, settings: Settings) -> tuple[User, str]:
    """Registra una cuenta por la API y devuelve la persona y el token de su enlace."""
    client.post(_REGISTRO, json=_registro())
    user = db.scalars(select(User)).one()
    enlace = verification_link(settings, user.id, user.email)
    return user, enlace.split("#t=")[1]


def test_el_enlace_verifica_el_correo_y_deja_constancia(
    client: TestClient, db: Session, settings: Settings
) -> None:
    user, token = _cuenta_registrada(client, db, settings)

    respuesta = client.post(_VERIFICAR, json={"token": token})

    assert respuesta.status_code == 204
    assert respuesta.headers["cache-control"] == "no-store"
    db.refresh(user)
    assert user.email_verified_at is not None
    membership = db.scalars(select(Membership).where(Membership.user_id == user.id)).one()
    set_tenant(db, TenantContext(organization_id=membership.organization_id, user_id=user.id))
    acciones = db.scalars(select(AuditLog.action).order_by(AuditLog.created_at)).all()
    assert acciones == ["user_registered", "email_verified"]


def test_el_enlace_sirve_una_sola_vez(client: TestClient, db: Session, settings: Settings) -> None:
    _, token = _cuenta_registrada(client, db, settings)
    client.post(_VERIFICAR, json={"token": token})

    respuesta = client.post(_VERIFICAR, json={"token": token})

    assert respuesta.status_code == 400
    assert respuesta.headers["content-type"] == PROBLEM_JSON


def test_si_el_correo_cambio_el_enlace_ya_no_sirve(
    client: TestClient, db: Session, settings: Settings
) -> None:
    user, token = _cuenta_registrada(client, db, settings)
    user.email = "nuevo@example.com"
    db.flush()

    assert client.post(_VERIFICAR, json={"token": token}).status_code == 400
    db.refresh(user)
    assert user.email_verified_at is None


def test_todo_enlace_invalido_recibe_el_mismo_mensaje(
    client: TestClient, db: Session, settings: Settings
) -> None:
    user, token = _cuenta_registrada(client, db, settings)
    vencido = issue_link(
        TEST_SIGNING_KEY,
        LinkPurpose.EMAIL_VERIFICATION,
        user.id,
        verification_state(user.email),
        datetime.timedelta(hours=24),
        now=datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=2),
    )
    otra_clave = issue_link(
        "otra-clave-maestra-de-prueba-de-32-caracteres-o-mas",
        LinkPurpose.EMAIL_VERIFICATION,
        user.id,
        verification_state(user.email),
        datetime.timedelta(hours=24),
    )

    respuestas = [
        client.post(_VERIFICAR, json={"token": malo})
        for malo in (vencido, otra_clave, token[:-4] + "AAAA", "abc")
    ]

    assert {r.status_code for r in respuestas} == {400}
    assert len({r.json()["detail"] for r in respuestas}) == 1
    db.refresh(user)
    assert user.email_verified_at is None


@pytest.mark.parametrize("cuerpo", [{"token": ""}, {"token": "x" * 1025}, {}])
def test_un_token_vacio_o_enorme_se_rechaza_antes_de_leerlo(
    client: TestClient, cuerpo: dict[str, Any]
) -> None:
    assert client.post(_VERIFICAR, json=cuerpo).status_code == 422


def test_la_verificacion_tiene_tope_por_ip(client: TestClient) -> None:
    for _ in range(20):
        assert client.post(_VERIFICAR, json={"token": "abc"}).status_code == 400

    assert client.post(_VERIFICAR, json={"token": "abc"}).status_code == 429
