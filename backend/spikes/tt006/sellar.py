"""Criterio C6 de TT-006: pide un sello real a cada autoridad y lo verifica.

Sella un archivo de muestra, guarda en spikes/tt006/sellos la muestra, cada solicitud
(.tsq) y cada respuesta (.tsr), y verifica cada sello con rfc3161-client contra las
autoridades raíz de Debian. De cada sello que verifica guarda la raíz que ancla su cadena
(<autoridad>-raiz.pem), la que se fijaría en producción.

Se ejecuta a mano desde C:\\Aletheia\\backend, con WSL encendido:

    uv run --group spike python -m spikes.tt006.sellar
"""

import hashlib
import urllib.error
from datetime import UTC, datetime
from pathlib import Path

from cryptography.hazmat.primitives.serialization import Encoding
from rfc3161_client import VerificationError

from spikes.tt006 import sello

CARPETA = Path(__file__).parent / "sellos"
# Las mismas raíces que usa openssl en Debian, leídas desde Windows.
RAICES = Path(r"\\wsl.localhost\Debian\etc\ssl\certs\ca-certificates.crt")


def _crear_muestra() -> bytes:
    contenido = (
        "ALETHEIA · TT-006\n"
        "Archivo de muestra para probar el sello de tiempo RFC 3161.\n"
        f"Creado: {datetime.now(UTC).isoformat(timespec='seconds')}\n"
    ).encode()
    (CARPETA / "muestra.txt").write_bytes(contenido)
    return contenido


def main() -> None:
    CARPETA.mkdir(exist_ok=True)
    huella = hashlib.sha256(_crear_muestra()).digest()
    raices = sello.cargar_raices(RAICES)
    print(f"Huella SHA-256 de muestra.txt: {huella.hex()}")
    print(f"Raíces de confianza cargadas desde Debian: {len(raices)}\n")

    for nombre, url in sello.AUTORIDADES.items():
        cuerpo, nonce = sello.solicitud(huella)
        (CARPETA / f"{nombre}.tsq").write_bytes(cuerpo)
        print(f"== {nombre} ({url})")
        try:
            respuesta = sello.pedir_sello(url, cuerpo)
        except (urllib.error.URLError, TimeoutError, sello.SelloInvalido) as error:
            print(f"   sin sello: {error}\n")
            continue
        (CARPETA / f"{nombre}.tsr").write_bytes(respuesta)
        try:
            resultado = sello.verificar(respuesta, huella, nonce, raices)
        except (VerificationError, ValueError) as error:
            print(f"   sello recibido, pero no verifica con rfc3161-client: {error}\n")
            continue
        print("   verifica con rfc3161-client: sí (nonce y huella coinciden)")
        print(f"   hora del sello: {resultado.hora.isoformat()}")
        print(f"   número de serie: {resultado.serie}")
        print(f"   política: {resultado.politica}")
        for certificado in resultado.cadena:
            print(f"   certificado incluido: {certificado}")
        print(f"   raíz que ancla la cadena: {resultado.raiz.subject.rfc4514_string()}")
        (CARPETA / f"{nombre}-raiz.pem").write_bytes(resultado.raiz.public_bytes(Encoding.PEM))
        print()


if __name__ == "__main__":
    main()
