"""Referencia para ADR-014: cifrar por fragmentos con AES-GCM de cryptography.

cryptography no trae cifrado autenticado por flujos: AESGCM cifra un mensaje completo en
una sola llamada. Para cifrar un archivo grande hay que partirlo y decidir nosotros el
formato: cómo se arma el nonce de cada fragmento, qué se autentica y cómo se reconoce el
final. Este módulo es la versión directa que propone la alternativa del ADR ("nonce por
bloque") y existe solo para medirla y mostrar su punto débil en las pruebas.

Formato: 8 bytes aleatorios de prefijo y, por cada fragmento de 1 MiB, AES-GCM con
nonce = prefijo + contador de 4 bytes y la etiqueta de 16 bytes al final.
"""

import hashlib
import os
from typing import BinaryIO, Final

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

FRAGMENTO_PLANO: Final = 1024 * 1024
_ETIQUETA: Final = 16
_PREFIJO: Final = 8


def nueva_llave() -> bytes:
    """Llave AES-256 de 32 bytes."""
    return AESGCM.generate_key(bit_length=256)


def cifrar(origen: BinaryIO, destino: BinaryIO, llave: bytes, datos: bytes) -> str:
    """Cifra por fragmentos y devuelve la huella SHA-256 del original."""
    aes = AESGCM(llave)
    prefijo = os.urandom(_PREFIJO)
    huella = hashlib.sha256()
    destino.write(prefijo)
    contador = 0
    while bloque := origen.read(FRAGMENTO_PLANO):
        huella.update(bloque)
        nonce = prefijo + contador.to_bytes(4, "big")
        destino.write(aes.encrypt(nonce, bloque, datos))
        contador += 1
    return huella.hexdigest()


def descifrar(origen: BinaryIO, destino: BinaryIO, llave: bytes, datos: bytes) -> str:
    """Descifra fragmento por fragmento; lanza InvalidTag si uno no se verifica."""
    aes = AESGCM(llave)
    prefijo = origen.read(_PREFIJO)
    huella = hashlib.sha256()
    contador = 0
    while fragmento := origen.read(FRAGMENTO_PLANO + _ETIQUETA):
        nonce = prefijo + contador.to_bytes(4, "big")
        bloque = aes.decrypt(nonce, fragmento, datos)
        huella.update(bloque)
        destino.write(bloque)
        contador += 1
    return huella.hexdigest()
