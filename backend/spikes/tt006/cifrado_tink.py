"""Cifrado por flujos con Tink Streaming AEAD.

Cada caso tiene su propia llave: un keyset de Tink con AES-256-GCM-HKDF en fragmentos de
1 MiB. El archivo se cifra mientras se lee, un bloque a la vez, y en la misma pasada se
calcula su huella SHA-256, así que nunca está completo en memoria.

La llave de caso se guarda envuelta con RSA-OAEP-256, el mismo algoritmo que usará Key
Vault. En esta prueba la llave maestra es local; en TT-007 vive en Key Vault y nunca sale.
"""

import hashlib
import uuid
from typing import BinaryIO, Final

import tink
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from tink import proto_keyset_format, secret_key_access, streaming_aead

streaming_aead.register()

PLANTILLA: Final = streaming_aead.streaming_aead_key_templates.AES256_GCM_HKDF_1MB
# Cuánto se lee del origen en cada vuelta; Tink arma sus propios fragmentos de 1 MiB.
TAMANO_BLOQUE: Final = 1024 * 1024
# Prefijo versionado de los datos asociados: si el formato cambia, cambia el prefijo.
_PREFIJO_DATOS: Final = b"aletheia/evidencia/v1"
_OAEP: Final = padding.OAEP(
    mgf=padding.MGF1(algorithm=hashes.SHA256()),
    algorithm=hashes.SHA256(),
    label=None,
)


def nueva_llave_de_caso() -> tink.KeysetHandle:
    """Genera la llave de datos de un caso nuevo."""
    return tink.new_keyset_handle(PLANTILLA)


def datos_asociados(caso: uuid.UUID, evidencia: uuid.UUID) -> bytes:
    """Ata el texto cifrado a su caso y a su evidencia: moverlo a otro hace fallar el descifrado."""
    return _PREFIJO_DATOS + caso.bytes + evidencia.bytes


def cifrar(origen: BinaryIO, destino: BinaryIO, llave: tink.KeysetHandle, datos: bytes) -> str:
    """Cifra `origen` en `destino` por bloques y devuelve la huella SHA-256 del original.

    Al terminar, Tink escribe el último fragmento y cierra `destino`.
    """
    primitiva = llave.primitive(streaming_aead.StreamingAead)
    huella = hashlib.sha256()
    with primitiva.new_encrypting_stream(destino, datos) as cifrador:
        while bloque := origen.read(TAMANO_BLOQUE):
            huella.update(bloque)
            cifrador.write(bloque)
    return huella.hexdigest()


def descifrar(origen: BinaryIO, destino: BinaryIO, llave: tink.KeysetHandle, datos: bytes) -> str:
    """Descifra `origen` en `destino` y devuelve la huella SHA-256 del resultado.

    Tink autentica cada fragmento antes de entregarlo: si uno fue alterado, cortado o
    movido, lanza `tink.TinkError` y ese fragmento nunca llega a `destino`.
    """
    primitiva = llave.primitive(streaming_aead.StreamingAead)
    huella = hashlib.sha256()
    with primitiva.new_decrypting_stream(origen, datos) as descifrador:
        while bloque := descifrador.read(TAMANO_BLOQUE):
            huella.update(bloque)
            destino.write(bloque)
    return huella.hexdigest()


def envolver(llave: tink.KeysetHandle, maestra: rsa.RSAPublicKey) -> bytes:
    """Serializa la llave de caso y la cifra con la llave maestra (RSA-OAEP-256)."""
    serializada: bytes = proto_keyset_format.serialize(llave, secret_key_access.TOKEN)
    return maestra.encrypt(serializada, _OAEP)


def desenvolver(envuelta: bytes, maestra: rsa.RSAPrivateKey) -> tink.KeysetHandle:
    """Recupera la llave de caso; falla si la llave envuelta fue alterada."""
    serializada = maestra.decrypt(envuelta, _OAEP)
    return proto_keyset_format.parse(serializada, secret_key_access.TOKEN)
