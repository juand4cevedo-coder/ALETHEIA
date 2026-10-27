"""Criterio C6 de TT-006 sin red: la solicitud y los sellos reales ya guardados.

Los sellos se piden con `python -m spikes.tt006.sellar`, que los deja en spikes/tt006/sellos
junto con la raíz que ancla cada cadena. Estas pruebas fijan el formato de la solicitud, la
razón para armarla con asn1crypto y verifican esos sellos reales sin conectarse a nada.
"""

import hashlib
from pathlib import Path

import pytest
from asn1crypto import tsp
from cryptography import x509
from rfc3161_client import HashAlgorithm, TimestampRequestBuilder, VerificationError

from spikes.tt006 import sello

HUELLA = hashlib.sha256(b"extracto bancario").digest()


def test_la_solicitud_lleva_la_huella_del_archivo_tal_cual() -> None:
    cuerpo, nonce = sello.solicitud(HUELLA)
    leida = tsp.TimeStampReq.load(cuerpo)

    assert leida["message_imprint"]["hash_algorithm"]["algorithm"].native == "sha256"
    assert leida["message_imprint"]["hashed_message"].native == HUELLA
    assert leida["nonce"].native == nonce
    assert leida["cert_req"].native is True


def test_cada_solicitud_lleva_un_nonce_distinto() -> None:
    assert sello.solicitud(HUELLA)[1] != sello.solicitud(HUELLA)[1]


def test_rfc3161_client_sellaria_el_hash_de_la_huella() -> None:
    """Por esto la solicitud no se arma con rfc3161-client."""
    solicitud = TimestampRequestBuilder().data(HUELLA).hash_algorithm(HashAlgorithm.SHA256).build()
    assert solicitud.message_imprint.message == hashlib.sha256(HUELLA).digest()
    assert solicitud.message_imprint.message != HUELLA


def test_solo_se_contacta_a_las_autoridades_configuradas() -> None:
    with pytest.raises(ValueError, match="autoridades configuradas"):
        sello.pedir_sello("http://169.254.169.254/latest", b"")


def test_la_huella_debe_ser_sha256() -> None:
    with pytest.raises(ValueError, match="SHA-256"):
        sello.solicitud(b"corta")


# Evidencia real: sellos guardados por `sellar` y verificados sin red contra su raíz.

SELLOS = Path(__file__).parent / "sellos"
CON_EVIDENCIA = sorted(
    p.name.removesuffix("-raiz.pem") for p in SELLOS.glob("*-raiz.pem") if p.is_file()
)


def _evidencia(nombre: str) -> tuple[bytes, bytes, int, list[x509.Certificate]]:
    respuesta = (SELLOS / f"{nombre}.tsr").read_bytes()
    huella = hashlib.sha256((SELLOS / "muestra.txt").read_bytes()).digest()
    nonce = tsp.TimeStampReq.load((SELLOS / f"{nombre}.tsq").read_bytes())["nonce"].native
    return respuesta, huella, nonce, sello.cargar_raices(SELLOS / f"{nombre}-raiz.pem")


@pytest.mark.parametrize("nombre", CON_EVIDENCIA)
def test_el_sello_real_verifica_con_su_raiz(nombre: str) -> None:
    respuesta, huella, nonce, raiz = _evidencia(nombre)
    assert sello.verificar(respuesta, huella, nonce, raiz).raiz == raiz[0]


@pytest.mark.parametrize("nombre", CON_EVIDENCIA)
def test_reordenar_los_certificados_no_toca_lo_firmado(nombre: str) -> None:
    respuesta, *_ = _evidencia(nombre)
    ordenado = sello.ordenar_certificados(respuesta)
    assert sello.contenido_firmado(ordenado) == sello.contenido_firmado(respuesta)


@pytest.mark.parametrize("nombre", CON_EVIDENCIA)
def test_el_sello_real_no_verifica_otro_archivo(nombre: str) -> None:
    respuesta, _, nonce, raiz = _evidencia(nombre)
    otra_huella = hashlib.sha256(b"otro archivo").digest()
    with pytest.raises(VerificationError):
        sello.verificar(respuesta, otra_huella, nonce, raiz)


@pytest.mark.parametrize("nombre", CON_EVIDENCIA)
def test_el_sello_real_alterado_no_verifica(nombre: str) -> None:
    respuesta, huella, nonce, raiz = _evidencia(nombre)
    # Se cambia un bit de la huella sellada dentro del sello: la firma deja de cuadrar.
    posicion = respuesta.index(huella)
    alterado = bytearray(respuesta)
    alterado[posicion] ^= 0x01
    with pytest.raises(VerificationError):
        sello.verificar(bytes(alterado), huella, nonce, raiz)
