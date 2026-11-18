"""Sello de tiempo RFC 3161 (INT-02, ADR-010, ADR-015): DigiCert como autoridad principal y
Sectigo como respaldo.

La solicitud se arma con asn1crypto sobre la huella SHA-256 del archivo tal cual: rfc3161-client
vuelve a calcular el hash de lo que recibe, así que con él se sellaría el hash de la huella y un
perito no podría verificar el sello con `openssl ts -verify -data archivo`. El sello se guarda
tal como llega; antes de verificarlo con rfc3161-client contra las raíces fijadas en este
paquete se reordenan en memoria sus certificados, porque DigiCert y Sectigo los envían fuera del
orden que exige DER y ese campo no lo cubre la firma de la autoridad. La decisión completa y por
qué FreeTSA se descartó están en ADR-015; la prueba técnica original vive en spikes/tt006.
"""

import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Final

from asn1crypto import cms, tsp
from cryptography import x509
from rfc3161_client import VerificationError, VerifierBuilder, decode_timestamp_response

# Únicas URL a las que este adaptador se conecta (INT-02). DigiCert primero; si no responde o
# niega el sello, se intenta con Sectigo.
AUTORIDADES: Final = (
    ("digicert", "http://timestamp.digicert.com"),
    ("sectigo", "http://timestamp.sectigo.com"),
)
ESPERA_SEGUNDOS: Final = 15
_RAICES_PATH: Final = Path(__file__).with_name("raices_sellado.pem")


@dataclass(frozen=True, slots=True)
class SelloDeTiempo:
    token: bytes
    hora: datetime


class SelloNoDisponibleError(RuntimeError):
    """Ninguna autoridad respondió a tiempo o concedió el sello; reintentar más tarde sirve."""


class SelloInvalidoError(RuntimeError):
    """Una autoridad respondió, pero el sello no verifica contra las raíces fijadas.

    No es un fallo transitorio de red: indica una cadena de certificación que cambió o una
    respuesta corrupta, así que reintentar con la misma huella no lo arregla.
    """


def _cargar_raices() -> list[x509.Certificate]:
    return x509.load_pem_x509_certificates(_RAICES_PATH.read_bytes())


def _solicitud(huella: bytes) -> tuple[bytes, int]:
    if len(huella) != 32:
        raise ValueError("la huella debe ser SHA-256 de 32 bytes")
    nonce = int.from_bytes(os.urandom(8), "big") >> 1
    peticion = tsp.TimeStampReq(
        {
            "version": "v1",
            "message_imprint": {
                "hash_algorithm": {"algorithm": "sha256"},
                "hashed_message": huella,
            },
            "nonce": nonce,
            "cert_req": True,
        }
    )
    return peticion.dump(), nonce


def _pedir_sello(url: str, cuerpo: bytes) -> bytes:
    if url not in {autoridad_url for _, autoridad_url in AUTORIDADES}:
        raise ValueError("solo se contacta a las autoridades configuradas")
    peticion = urllib.request.Request(  # noqa: S310
        url,
        data=cuerpo,
        headers={"Content-Type": "application/timestamp-query"},
        method="POST",
    )
    with urllib.request.urlopen(peticion, timeout=ESPERA_SEGUNDOS) as respuesta:  # noqa: S310
        if respuesta.headers.get_content_type() != "application/timestamp-reply":
            raise SelloInvalidoError("la respuesta no es application/timestamp-reply")
        contenido: bytes = respuesta.read()
        return contenido


def _ordenar_certificados(respuesta: bytes) -> bytes:
    """El sello con sus certificados en orden DER, sin tocar lo que la autoridad firmó."""
    sello = tsp.TimeStampResp.load(respuesta)
    if sello["status"]["status"].native != "granted":
        return respuesta
    firmados = sello["time_stamp_token"]["content"]
    firmados["certificates"] = cms.CertificateSet(list(firmados["certificates"]))
    normalizado: bytes = sello.dump()
    return normalizado


def _verificar(respuesta: bytes, huella: bytes, nonce: int) -> datetime:
    sello = decode_timestamp_response(_ordenar_certificados(respuesta))
    VerifierBuilder(roots=_cargar_raices(), nonce=nonce).build().verify(sello, huella)
    return sello.tst_info.gen_time


def _sellar_con(url: str, huella: bytes) -> SelloDeTiempo:
    cuerpo, nonce = _solicitud(huella)
    try:
        respuesta = _pedir_sello(url, cuerpo)
    except (urllib.error.URLError, TimeoutError) as exc:
        raise SelloNoDisponibleError(f"{url} no respondió: {exc}") from exc
    try:
        hora = _verificar(respuesta, huella, nonce)
    except (VerificationError, ValueError) as exc:
        # ValueError: asn1crypto o rfc3161-client no pudieron leer una respuesta truncada o
        # corrupta. No es un fallo de red: reintentar con la misma huella no lo arregla.
        raise SelloInvalidoError(f"{url} devolvió un sello que no verifica: {exc}") from exc
    return SelloDeTiempo(token=respuesta, hora=hora)


def pedir_sello_de_tiempo(huella: bytes) -> SelloDeTiempo:
    """Pide un sello RFC 3161 sobre la huella SHA-256 de una evidencia.

    Intenta primero con DigiCert; si no responde, se intenta con Sectigo. Si ninguna autoridad
    de red responde, lanza SelloNoDisponibleError (reintentable). Si una autoridad responde
    pero el sello no verifica, lanza SelloInvalidoError (no reintentable: EVT-evidence_stamped
    marca la evidencia como fallida en vez de dejarla pendiente para siempre).
    """
    ultimo_no_disponible: SelloNoDisponibleError | None = None
    for _, url in AUTORIDADES:
        try:
            return _sellar_con(url, huella)
        except SelloNoDisponibleError as exc:
            ultimo_no_disponible = exc
            continue
    assert ultimo_no_disponible is not None  # noqa: S101 — AUTORIDADES nunca está vacío
    raise ultimo_no_disponible
