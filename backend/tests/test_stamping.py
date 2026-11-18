"""Adaptador de sello de tiempo RFC 3161 (ADR-015), contra los sellos reales de spikes/tt006."""

import hashlib
import urllib.error
from pathlib import Path
from unittest.mock import patch

import pytest
from asn1crypto import tsp

from app.adapters import stamping

SELLOS = Path(__file__).parent.parent / "spikes" / "tt006" / "sellos"
HUELLA = hashlib.sha256((SELLOS / "muestra.txt").read_bytes()).digest()


def _respuesta(nombre: str) -> bytes:
    return (SELLOS / f"{nombre}.tsr").read_bytes()


def _nonce(nombre: str) -> int:
    return int(tsp.TimeStampReq.load((SELLOS / f"{nombre}.tsq").read_bytes())["nonce"].native)


def test_la_solicitud_lleva_la_huella_tal_cual() -> None:
    cuerpo, nonce = stamping._solicitud(HUELLA)
    leida = tsp.TimeStampReq.load(cuerpo)
    assert leida["message_imprint"]["hashed_message"].native == HUELLA
    assert leida["nonce"].native == nonce
    assert leida["cert_req"].native is True


def test_la_huella_debe_ser_sha256() -> None:
    with pytest.raises(ValueError, match="SHA-256"):
        stamping._solicitud(b"corta")


@pytest.mark.parametrize("nombre", ["digicert", "sectigo"])
def test_el_sello_real_verifica_contra_las_raices_fijadas(nombre: str) -> None:
    hora = stamping._verificar(_respuesta(nombre), HUELLA, _nonce(nombre))
    assert hora.year == 2026


def test_reordenar_los_certificados_no_toca_lo_firmado() -> None:
    respuesta = _respuesta("digicert")
    ordenado = stamping._ordenar_certificados(respuesta)
    original = tsp.TimeStampResp.load(respuesta)["time_stamp_token"]["content"][
        "encap_content_info"
    ]["content"].contents
    reordenado = tsp.TimeStampResp.load(ordenado)["time_stamp_token"]["content"][
        "encap_content_info"
    ]["content"].contents
    assert original == reordenado


def test_pide_el_sello_a_digicert_cuando_responde() -> None:
    with (
        patch.object(stamping, "_pedir_sello", return_value=_respuesta("digicert")),
        patch.object(stamping, "_solicitud", return_value=(b"", _nonce("digicert"))),
    ):
        resultado = stamping.pedir_sello_de_tiempo(HUELLA)
    assert resultado.token == _respuesta("digicert")
    assert resultado.hora.year == 2026


def test_usa_sectigo_si_digicert_no_responde() -> None:
    llamadas = {"digicert": 0, "sectigo": 0}

    def pedir(url: str, cuerpo: bytes) -> bytes:
        if "digicert" in url:
            llamadas["digicert"] += 1
            raise urllib.error.URLError("sin respuesta")
        llamadas["sectigo"] += 1
        return _respuesta("sectigo")

    with (
        patch.object(stamping, "_pedir_sello", side_effect=pedir),
        patch.object(stamping, "_solicitud", return_value=(b"", _nonce("sectigo"))),
    ):
        resultado = stamping.pedir_sello_de_tiempo(HUELLA)
    assert llamadas == {"digicert": 1, "sectigo": 1}
    assert resultado.token == _respuesta("sectigo")


def test_sin_ninguna_autoridad_disponible_es_reintentable() -> None:
    with (
        patch.object(stamping, "_pedir_sello", side_effect=urllib.error.URLError("sin respuesta")),
        pytest.raises(stamping.SelloNoDisponibleError),
    ):
        stamping.pedir_sello_de_tiempo(HUELLA)


def test_un_sello_que_no_verifica_no_es_reintentable() -> None:
    with (
        patch.object(stamping, "_pedir_sello", return_value=_respuesta("digicert")),
        patch.object(stamping, "_solicitud", return_value=(b"", _nonce("digicert") + 1)),
        pytest.raises(stamping.SelloInvalidoError),
    ):
        stamping.pedir_sello_de_tiempo(HUELLA)
