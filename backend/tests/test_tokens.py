"""Pruebas de los tokens firmados: enlaces de un solo uso y acceso de las sesiones."""

import base64
import datetime
import json
import uuid

import jwt
import pytest

from app.core.tokens import (
    MAX_TOKEN_LENGTH,
    InvalidAccessTokenError,
    InvalidExportLinkError,
    InvalidLinkError,
    LinkPurpose,
    export_manifest_matches,
    issue_access_token,
    issue_export_download_link,
    issue_link,
    read_access_token,
    read_export_download_link,
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
    sin_firma = jwt.encode(_contenido(_enlace()), key="", algorithm="none")

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


# --- Acceso de las sesiones --------------------------------------------------------------

_SESION = uuid.UUID("01890a5d-ac96-774b-bcce-b302099a8058")
_DIEZ_MINUTOS = datetime.timedelta(minutes=10)


def _acceso(**cambios: object) -> str:
    argumentos: dict[str, object] = {
        "master_key": _CLAVE,
        "subject": _PERSONA,
        "session_id": _SESION,
        "lifetime": _DIEZ_MINUTOS,
    }
    argumentos.update(cambios)
    return issue_access_token(**argumentos)  # type: ignore[arg-type]


def test_un_acceso_vigente_devuelve_su_dueno_y_su_sesion() -> None:
    claims = read_access_token(_CLAVE, _acceso())

    assert claims.subject == _PERSONA
    assert claims.session_id == _SESION


def test_el_acceso_solo_lleva_identificadores() -> None:
    contenido = _contenido(_acceso())

    assert set(contenido) == {"iss", "aud", "sub", "sid", "iat", "exp"}
    assert contenido["aud"] == "session"
    assert contenido["exp"] == contenido["iat"] + 600  # type: ignore[operator]


def test_un_acceso_vencido_no_sirve() -> None:
    hace_once_minutos = datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=11)

    with pytest.raises(InvalidAccessTokenError):
        read_access_token(_CLAVE, _acceso(now=hace_once_minutos))


def test_un_acceso_firmado_con_otra_clave_no_sirve() -> None:
    with pytest.raises(InvalidAccessTokenError):
        read_access_token(_OTRA_CLAVE, _acceso())


def test_un_enlace_no_sirve_como_acceso_ni_un_acceso_como_enlace() -> None:
    # Cada uso tiene su subclave y su audiencia: ningún token cruza de uno al otro.
    with pytest.raises(InvalidAccessTokenError):
        read_access_token(_CLAVE, _enlace())
    with pytest.raises(InvalidLinkError):
        read_link(_CLAVE, _PROPOSITO, _acceso())


def test_un_acceso_sin_sesion_o_sin_firma_no_sirve() -> None:
    sin_sesion = {k: v for k, v in _contenido(_acceso()).items() if k != "sid"}
    con_la_maestra = jwt.encode(sin_sesion, _CLAVE, algorithm="HS256")
    sin_firma = jwt.encode(_contenido(_acceso()), key="", algorithm="none")

    for token in (con_la_maestra, sin_firma):
        with pytest.raises(InvalidAccessTokenError):
            read_access_token(_CLAVE, token)


@pytest.mark.parametrize("token", ["", "abc", "a.b.c", "x" * (MAX_TOKEN_LENGTH + 1)])
def test_un_texto_que_no_es_un_acceso_no_sirve(token: str) -> None:
    with pytest.raises(InvalidAccessTokenError):
        read_access_token(_CLAVE, token)


# --- Enlaces transferibles de exportación ------------------------------------------------

_EXPORTACION = uuid.UUID("01890a5d-ac96-774b-bcce-b302099a8070")
_ORGANIZACION = uuid.UUID("01890a5d-ac96-774b-bcce-b302099a8059")
_HUELLA = b"\xaa" * 32


def _export_link(*, now: datetime.datetime | None = None) -> str:
    moment = now or datetime.datetime.now(datetime.UTC)
    return issue_export_download_link(
        _CLAVE,
        _EXPORTACION,
        _ORGANIZACION,
        _HUELLA,
        moment + datetime.timedelta(hours=24),
        now=moment,
    )


def test_enlace_exportacion_firma_organizacion_y_huella_sin_exponerla() -> None:
    token = _export_link()
    claims = read_export_download_link(_CLAVE, token)
    assert claims.export_id == _EXPORTACION
    assert claims.organization_id == _ORGANIZACION
    assert export_manifest_matches(_CLAVE, claims, _HUELLA)
    assert not export_manifest_matches(_CLAVE, claims, b"\xbb" * 32)
    payload = _contenido(token)
    assert payload["aud"] == "export_download"
    assert payload["exp"] == payload["iat"] + 86400  # type: ignore[operator]
    assert _HUELLA.hex() not in json.dumps(payload)


def test_enlace_exportacion_vencido_o_de_otro_uso_no_sirve() -> None:
    expired = _export_link(now=datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=2))
    with pytest.raises(InvalidExportLinkError):
        read_export_download_link(_CLAVE, expired)
    with pytest.raises(InvalidExportLinkError):
        read_export_download_link(_CLAVE, _enlace())
    with pytest.raises(InvalidLinkError):
        read_link(_CLAVE, _PROPOSITO, _export_link())


def test_enlace_exportacion_alterado_o_firmado_con_otra_clave_no_sirve() -> None:
    token = _export_link()
    with pytest.raises(InvalidExportLinkError):
        read_export_download_link(_OTRA_CLAVE, token)
    with pytest.raises(InvalidExportLinkError):
        read_export_download_link(_CLAVE, token + "x")


def test_enlace_exportacion_exige_huella_y_vencimiento() -> None:
    now = datetime.datetime.now(datetime.UTC)
    with pytest.raises(ValueError, match="huella"):
        issue_export_download_link(_CLAVE, _EXPORTACION, _ORGANIZACION, b"corta", now + _DIA)
    with pytest.raises(ValueError, match="vencimiento"):
        issue_export_download_link(_CLAVE, _EXPORTACION, _ORGANIZACION, _HUELLA, now - _DIA)
