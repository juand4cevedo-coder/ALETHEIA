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
from http.client import HTTPMessage
from pathlib import Path
from typing import IO, Final, override

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
_MAX_RESPUESTA: Final = 1024 * 1024
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


class _SinRedirecciones(urllib.request.HTTPRedirectHandler):
    @override
    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: IO[bytes],
        code: int,
        msg: str,
        headers: HTTPMessage,
        newurl: str,
    ) -> None:
        # Dejar que urllib cierre la respuesta HTTP sin contactar otro destino.
        return None


def _pedir_sello(url: str, cuerpo: bytes) -> bytes:
    if url not in {autoridad_url for _, autoridad_url in AUTORIDADES}:
        raise ValueError("solo se contacta a las autoridades configuradas")
    peticion = urllib.request.Request(  # noqa: S310
        url,
        data=cuerpo,
        headers={"Content-Type": "application/timestamp-query"},
        method="POST",
    )
    with urllib.request.build_opener(_SinRedirecciones).open(
        peticion, timeout=ESPERA_SEGUNDOS
    ) as respuesta:
        if respuesta.headers.get_content_type() != "application/timestamp-reply":
            raise SelloInvalidoError("la respuesta no es application/timestamp-reply")
        contenido: bytes = respuesta.read(_MAX_RESPUESTA + 1)
        if len(contenido) > _MAX_RESPUESTA:
            raise SelloInvalidoError("la respuesta de sellado supera el tamaño permitido")
        return contenido


def _ordenar_certificados(respuesta: bytes) -> bytes:
    """El sello, concedido, con sus certificados en orden DER, sin tocar lo que firmó."""
    sello = tsp.TimeStampResp.load(respuesta)
    firmados = sello["time_stamp_token"]["content"]
    firmados["certificates"] = cms.CertificateSet(list(firmados["certificates"]))
    normalizado: bytes = sello.dump()
    return normalizado


# PKIStatus que sí traen un token que verificar (RFC 3161, sección 2.4.2).
_CONCEDIDO: Final = frozenset({"granted", "granted_with_mods"})
# PKIFailureInfo que indican un problema del lado de la autoridad, no de la solicitud: vale la
# pena reintentar, incluso con la otra autoridad.
_RECHAZO_TEMPORAL: Final = frozenset(
    {"system_failure", "time_not_available", "add_info_not_available"}
)


def _verificar(respuesta: bytes, huella: bytes, nonce: int) -> datetime:
    estado = tsp.TimeStampResp.load(respuesta)["status"]
    if estado["status"].native not in _CONCEDIDO:
        fallas = estado["fail_info"].native if estado["fail_info"] else set()
        if fallas & _RECHAZO_TEMPORAL:
            raise SelloNoDisponibleError(f"rechazo temporal de la autoridad: {sorted(fallas)}")
        raise SelloInvalidoError(f"la autoridad no concedió el sello: {estado['status'].native}")
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
