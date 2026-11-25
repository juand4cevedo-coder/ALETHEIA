"""Verificación de persona por prueba de trabajo en los formularios de acceso."""

import base64
import datetime
import hashlib
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.core.config import Settings
from app.main import create_app
from app.services import captcha
from tests.conftest import SAME_ORIGIN_HEADERS, TEST_SIGNING_KEY

NOW = datetime.datetime(2026, 11, 25, 15, 0, tzinfo=datetime.UTC)


def _solve(challenge: dict[str, object]) -> str:
    """Lo mismo que hace el navegador: probar números hasta dar con el resumen."""
    salt = str(challenge["salt"])
    for number in range(int(str(challenge["maxnumber"])) + 1):
        if hashlib.sha256(f"{salt}{number}".encode()).hexdigest() == challenge["challenge"]:
            payload = {
                "algorithm": challenge["algorithm"],
                "challenge": challenge["challenge"],
                "number": number,
                "salt": salt,
                "signature": challenge["signature"],
            }
            return base64.b64encode(json.dumps(payload).encode()).decode()
    raise AssertionError("El reto no tiene solución")


def _challenge(now: datetime.datetime = NOW) -> dict[str, object]:
    created = captcha.create(TEST_SIGNING_KEY, 2_000, now)
    return {
        "algorithm": created.algorithm,
        "challenge": created.challenge,
        "maxnumber": created.maxnumber,
        "salt": created.salt,
        "signature": created.signature,
    }


def test_una_solucion_correcta_pasa_una_sola_vez(owner_db: Session) -> None:
    solution = _solve(_challenge())
    captcha.verify(owner_db, TEST_SIGNING_KEY, solution, NOW)
    with pytest.raises(captcha.CaptchaError):
        captcha.verify(owner_db, TEST_SIGNING_KEY, solution, NOW)


def test_rechaza_retos_vencidos_falsos_o_mal_formados(owner_db: Session) -> None:
    vencido = _solve(_challenge(NOW - datetime.timedelta(minutes=11)))
    with pytest.raises(captcha.CaptchaError):
        captcha.verify(owner_db, TEST_SIGNING_KEY, vencido, NOW)

    # Firmado con otra clave: alguien que inventa sus propios retos.
    falso = captcha.create("otra-clave-de-firma-de-al-menos-32-caracteres", 2_000, NOW)
    with pytest.raises(captcha.CaptchaError):
        captcha.verify(
            owner_db,
            TEST_SIGNING_KEY,
            _solve(
                {
                    "algorithm": falso.algorithm,
                    "challenge": falso.challenge,
                    "maxnumber": falso.maxnumber,
                    "salt": falso.salt,
                    "signature": falso.signature,
                }
            ),
            NOW,
        )

    # Número equivocado.
    reto = _challenge()
    datos = json.loads(base64.b64decode(_solve(reto)))
    datos["number"] += 1
    with pytest.raises(captcha.CaptchaError):
        captcha.verify(
            owner_db, TEST_SIGNING_KEY, base64.b64encode(json.dumps(datos).encode()).decode(), NOW
        )

    for basura in (None, "", "no-es-base64", base64.b64encode(b"[]").decode()):
        with pytest.raises(captcha.CaptchaError):
            captcha.verify(owner_db, TEST_SIGNING_KEY, basura, NOW)


def test_produccion_no_permite_apagarla(settings: Settings) -> None:
    with pytest.raises(ValueError, match="verificación de persona"):
        Settings.model_validate(
            {**settings.model_dump(), "environment": "production", "captcha_required": False}
        )


@pytest.fixture
def con_captcha(settings: Settings, db: Session) -> TestClient:
    application: FastAPI = create_app(settings.model_copy(update={"captcha_required": True}))
    application.dependency_overrides[get_session] = lambda: db
    cliente = TestClient(application, base_url="https://testserver", headers=SAME_ORIGIN_HEADERS)
    cliente.__enter__()
    return cliente


@pytest.mark.parametrize(
    ("path", "body"),
    [
        ("/api/v1/auth/login", {"email": "nadie@example.com", "password": "Clave-segura-123!"}),
        ("/api/v1/auth/password/forgot", {"email": "nadie@example.com"}),
        ("/api/v1/auth/verify-email/resend", {"email": "nadie@example.com"}),
    ],
)
def test_los_formularios_de_acceso_la_exigen(
    con_captcha: TestClient, path: str, body: dict[str, str]
) -> None:
    sin = con_captcha.post(path, json=body)
    assert sin.status_code == 400
    assert "persona" in sin.json()["detail"]

    reto = con_captcha.get("/api/v1/auth/captcha")
    assert reto.status_code == 200
    assert reto.headers["cache-control"] == "no-store"
    solucion = _solve(reto.json())
    con = con_captcha.post(path, json=body, headers={"X-Aletheia-Captcha": solucion})
    assert con.status_code != 400

    repetida = con_captcha.post(path, json=body, headers={"X-Aletheia-Captcha": solucion})
    assert repetida.status_code == 400


def test_el_registro_tambien_la_exige(con_captcha: TestClient) -> None:
    respuesta = con_captcha.post(
        "/api/v1/auth/register",
        json={
            "account_type": "individual",
            "full_name": "Persona de prueba",
            "email": "registro-captcha@example.com",
            "password": "Clave-segura-123!",
            "legal_version": "x",
            "accepts_legal_terms": True,
        },
    )
    assert respuesta.status_code == 400
