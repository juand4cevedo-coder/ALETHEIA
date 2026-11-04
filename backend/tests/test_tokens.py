"""Pruebas de los enlaces firmados de un solo uso."""

import base64
import datetime
import json
import uuid

import jwt
import pytest

from app.core.tokens import (
    MAX_TOKEN_LENGTH,
    InvalidLinkError,
    LinkPurpose,
    issue_link,
    read_link,
    state_matches,
)

_CLAVE = "clave-maestra-de-prueba-con-mas-de-32-caracteres"
_OTRA_CLAVE = "otra-clave-maestra-de-prueba-de-32-caracteres-o-mas"
_PROPOSITO = LinkPurpose.EMAIL_VERIFICATION
_PERSONA = uuid.UUID("01890a5d-ac96-774b-bcce-b302099a8057")
_ESTADO = "abogada@example.com"
_DIA = datetime.timedelta(hours=24)


def _enlace(**cambios: object) -> str:
    argumentos: dict[str, object] = {
        "master_key": _CLAVE,
        "purpose": _PROPOSITO,
        "subject": _PERSONA,
        "state": _ESTADO,
        "lifetime": _DIA,
    }
    argumentos.update(cambios)
    return issue_link(**argumentos)  # type: ignore[arg-type]


def _contenido(token: str) -> dict[str, object]:
    payload = token.split(".")[1]
    datos: dict[str, object] = json.loads(
        base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))
    )
    return datos


def test_un_enlace_vigente_devuelve_su_dueno_y_su_estado() -> None:
    claims = read_link(_CLAVE, _PROPOSITO, _enlace())

    assert claims.subject == _PERSONA
    assert state_matches(_CLAVE, _PROPOSITO, claims, _ESTADO)


def test_el_enlace_deja_de_valer_cuando_cambia_el_estado() -> None:
    claims = read_link(_CLAVE, _PROPOSITO, _enlace())

    assert not state_matches(_CLAVE, _PROPOSITO, claims, "otra@example.com")


def test_el_enlace_no_deja_ver_el_estado_en_claro() -> None:
    # El token se puede leer: el estado va sellado con HMAC, ni en claro ni como SHA-256 simple.
    contenido = _contenido(_enlace())

    assert _ESTADO not in json.dumps(contenido)
    assert contenido["aud"] == "email_verification"


def test_un_enlace_vencido_no_sirve() -> None:
    hace_dos_dias = datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=2)

    with pytest.raises(InvalidLinkError):
        read_link(_CLAVE, _PROPOSITO, _enlace(now=hace_dos_dias))


def test_un_enlace_firmado_con_otra_clave_no_sirve() -> None:
    with pytest.raises(InvalidLinkError):
        read_link(_OTRA_CLAVE, _PROPOSITO, _enlace())


def test_un_enlace_alterado_no_sirve() -> None:
    cabecera, _, firma = _enlace().split(".")
    otro = _contenido(_enlace(subject=uuid.uuid7()))
    contenido_falso = base64.urlsafe_b64encode(json.dumps(otro).encode()).decode().rstrip("=")

    with pytest.raises(InvalidLinkError):
        read_link(_CLAVE, _PROPOSITO, f"{cabecera}.{contenido_falso}.{firma}")


def test_un_token_sin_firma_no_sirve() -> None:
    sin_firma = jwt.encode(_contenido(_enlace()), key=None, algorithm="none")

    with pytest.raises(InvalidLinkError):
        read_link(_CLAVE, _PROPOSITO, sin_firma)


def test_un_token_de_otro_uso_no_sirve() -> None:
    # Firmado con la clave maestra directa y no con la subclave del uso: no valida.
    contenido = _contenido(_enlace())
    con_la_maestra = jwt.encode(contenido, _CLAVE, algorithm="HS256")

    with pytest.raises(InvalidLinkError):
        read_link(_CLAVE, _PROPOSITO, con_la_maestra)


@pytest.mark.parametrize("token", ["", "abc", "a.b.c", "x" * (MAX_TOKEN_LENGTH + 1)])
def test_un_texto_que_no_es_un_enlace_no_sirve(token: str) -> None:
    with pytest.raises(InvalidLinkError):
        read_link(_CLAVE, _PROPOSITO, token)
