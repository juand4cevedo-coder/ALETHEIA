"""Criterio C6 de TT-006: pedir y verificar un sello de tiempo RFC 3161.

La solicitud se arma con asn1crypto para que la autoridad selle la huella SHA-256 del
archivo tal cual. rfc3161-client siempre vuelve a calcular el hash de lo que recibe: con
él se sellaría el hash de la huella, y un perito no podría verificar el sello con
`openssl ts -verify -data archivo`. La verificación sí se hace con rfc3161-client, que
acepta una huella ya calculada.

DigiCert y Sectigo envían los certificados del sello sin el orden que DER exige para un
conjunto, y rfc3161-client, que es estricto, se niega a leerlos. Ese campo no lo cubre la
firma de la autoridad, así que antes de verificar se reordena en memoria. El sello se
guarda tal como llegó.
"""

import os
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Final

from asn1crypto import cms, tsp
from cryptography import x509
from rfc3161_client import (
    TimeStampResponse,
    VerificationError,
    VerifierBuilder,
    decode_timestamp_response,
)

# Autoridades públicas que se prueban (INT-02). Son las únicas URL a las que se conecta.
AUTORIDADES: Final = {
    "digicert": "http://timestamp.digicert.com",
    "sectigo": "http://timestamp.sectigo.com",
    "freetsa": "https://freetsa.org/tsr",
}
ESPERA_SEGUNDOS: Final = 15  # tiempo máximo de INT-02


class SelloInvalido(Exception):
    """La autoridad respondió algo que no es un sello de tiempo."""


@dataclass(frozen=True)
class Sello:
    hora: datetime
    serie: int
    politica: str
    cadena: list[str]
    raiz: x509.Certificate


def solicitud(huella: bytes) -> tuple[bytes, int]:
    """Arma la solicitud con la huella SHA-256 tal cual, un nonce aleatorio y el certificado."""
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


def pedir_sello(url: str, cuerpo: bytes) -> bytes:
    """Envía la solicitud a una de las URL fijas de AUTORIDADES y devuelve la respuesta."""
    if url not in AUTORIDADES.values():
        raise ValueError("solo se contacta a las autoridades configuradas")
    # S310: la URL no la da el usuario; se acaba de comprobar contra AUTORIDADES.
    peticion = urllib.request.Request(  # noqa: S310
        url,
        data=cuerpo,
        headers={"Content-Type": "application/timestamp-query"},
        method="POST",
    )
    with urllib.request.urlopen(peticion, timeout=ESPERA_SEGUNDOS) as respuesta:  # noqa: S310
        if respuesta.headers.get_content_type() != "application/timestamp-reply":
            raise SelloInvalido("la respuesta no es application/timestamp-reply")
        contenido: bytes = respuesta.read()
        return contenido


def cargar_raices(ruta: Path) -> list[x509.Certificate]:
    """Lee un archivo PEM con las autoridades raíz en las que se confía."""
    return x509.load_pem_x509_certificates(ruta.read_bytes())


def ordenar_certificados(respuesta: bytes) -> bytes:
    """Devuelve el sello con sus certificados en orden DER, sin tocar lo que está firmado.

    La firma de la autoridad cubre los atributos firmados y, a través de ellos, la
    información del sello (hora, huella, nonce). La lista de certificados va aparte y su
    orden no cambia nada de lo que se verifica.
    """
    sello = tsp.TimeStampResp.load(respuesta)
    if sello["status"]["status"].native != "granted":
        return respuesta
    firmados = sello["time_stamp_token"]["content"]
    firmados["certificates"] = cms.CertificateSet(list(firmados["certificates"]))
    normalizado: bytes = sello.dump()
    return normalizado


def contenido_firmado(respuesta: bytes) -> bytes:
    """La información del sello tal como la firmó la autoridad (TSTInfo)."""
    sello = tsp.TimeStampResp.load(respuesta)
    contenido: bytes = sello["time_stamp_token"]["content"]["encap_content_info"][
        "content"
    ].contents
    return contenido


def verificar(respuesta: bytes, huella: bytes, nonce: int, raices: list[x509.Certificate]) -> Sello:
    """Verifica firma, cadena hasta una raíz de confianza, nonce y huella sellada.

    Lanza rfc3161_client.VerificationError si algo no cuadra. Devuelve también la raíz
    que ancla la cadena, que es la que se fijaría en producción.
    """
    sello = decode_timestamp_response(ordenar_certificados(respuesta))
    VerifierBuilder(roots=list(raices), nonce=nonce).build().verify(sello, huella)
    certificados = [x509.load_der_x509_certificate(c) for c in sello.signed_data.certificates]
    return Sello(
        hora=sello.tst_info.gen_time,
        serie=sello.tst_info.serial_number,
        politica=sello.tst_info.policy.dotted_string,
        cadena=[c.subject.rfc4514_string() for c in certificados],
        raiz=_raiz_que_ancla(sello, huella, nonce, certificados, raices),
    )


def _raiz_que_ancla(
    sello: TimeStampResponse,
    huella: bytes,
    nonce: int,
    certificados: list[x509.Certificate],
    raices: list[x509.Certificate],
) -> x509.Certificate:
    """Prueba una por una las raíces que emitieron algún certificado de la cadena."""
    emisores = {c.issuer for c in certificados}
    for raiz in raices:
        if raiz.subject not in emisores:
            continue
        try:
            VerifierBuilder(roots=[raiz], nonce=nonce).build().verify(sello, huella)
        except VerificationError:
            continue
        return raiz
    raise VerificationError("ninguna raíz por sí sola ancla la cadena")
