"""Criterios C1, C3 y C4 de TT-006 con Tink Streaming AEAD.

Formato de Tink con AES256_GCM_HKDF_1MB: el texto cifrado va en fragmentos de 1 MiB. El
primero lleva un encabezado de 40 bytes y cada fragmento termina en una etiqueta de 16
bytes, así que el primero guarda 1.048.520 bytes del original y los demás 1.048.560.
"""

import hashlib
import io
import os
import uuid
from pathlib import Path

import pytest
import tink
from cryptography.hazmat.primitives.asymmetric import rsa

from spikes.tt006 import cifrado_tink as ct
from spikes.tt006 import flujos

FRAGMENTO = 1024 * 1024
PRIMER_FRAGMENTO_PLANO = FRAGMENTO - 40 - 16
FRAGMENTO_PLANO = FRAGMENTO - 16


@pytest.fixture
def llave() -> tink.KeysetHandle:
    return ct.nueva_llave_de_caso()


@pytest.fixture
def datos() -> bytes:
    return ct.datos_asociados(uuid.uuid7(), uuid.uuid7())


@pytest.fixture(scope="module")
def maestra() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=3072)


class _Memoria(io.BytesIO):
    """Destino en memoria que conserva lo escrito aunque Tink lo cierre al terminar."""

    contenido = b""

    def close(self) -> None:
        if not self.closed:
            self.contenido = self.getvalue()
        super().close()


def _cifrar(contenido: bytes, llave: tink.KeysetHandle, datos: bytes) -> bytes:
    destino = _Memoria()
    ct.cifrar(io.BytesIO(contenido), destino, llave, datos)
    return destino.contenido


def _descifrar(texto_cifrado: bytes, llave: tink.KeysetHandle, datos: bytes) -> bytes:
    destino = io.BytesIO()
    ct.descifrar(io.BytesIO(texto_cifrado), destino, llave, datos)
    return destino.getvalue()


# C1: ida y vuelta


@pytest.mark.parametrize(
    "tamano",
    [
        0,
        1,
        PRIMER_FRAGMENTO_PLANO - 1,
        PRIMER_FRAGMENTO_PLANO,
        PRIMER_FRAGMENTO_PLANO + 1,
        PRIMER_FRAGMENTO_PLANO + FRAGMENTO_PLANO,
        PRIMER_FRAGMENTO_PLANO + FRAGMENTO_PLANO + 1,
    ],
)
def test_ida_y_vuelta_conserva_el_original(
    tamano: int, llave: tink.KeysetHandle, datos: bytes
) -> None:
    original = os.urandom(tamano)
    texto_cifrado = _cifrar(original, llave, datos)
    assert _descifrar(texto_cifrado, llave, datos) == original


def test_ida_y_vuelta_de_300_mb(tmp_path: Path, llave: tink.KeysetHandle, datos: bytes) -> None:
    ruta_cifrada = tmp_path / "evidencia.bin"
    with ruta_cifrada.open("wb") as destino:
        huella_original = ct.cifrar(
            io.BufferedReader(flujos.Generado(300 * 1024 * 1024)), destino, llave, datos
        )

    with ruta_cifrada.open("rb") as origen:
        huella_descifrada = ct.descifrar(origen, io.BufferedWriter(flujos.Descarte()), llave, datos)

    assert huella_descifrada == huella_original


# C3: manipulación


def _tres_fragmentos_y_medio() -> bytes:
    return os.urandom(PRIMER_FRAGMENTO_PLANO + 2 * FRAGMENTO_PLANO + 100)


def test_un_byte_alterado_no_se_descifra(llave: tink.KeysetHandle, datos: bytes) -> None:
    alterado = bytearray(_cifrar(_tres_fragmentos_y_medio(), llave, datos))
    alterado[FRAGMENTO + 1000] ^= 0x01
    with pytest.raises(tink.TinkError):
        _descifrar(bytes(alterado), llave, datos)


def test_el_fragmento_alterado_nunca_se_entrega(llave: tink.KeysetHandle, datos: bytes) -> None:
    original = _tres_fragmentos_y_medio()
    alterado = bytearray(_cifrar(original, llave, datos))
    alterado[FRAGMENTO + 1000] ^= 0x01

    entregado = io.BytesIO()
    with pytest.raises(tink.TinkError):
        ct.descifrar(io.BytesIO(bytes(alterado)), entregado, llave, datos)

    # Lo entregado, si hay algo, es un prefijo verificado del original y no llega al fragmento 2.
    salida = entregado.getvalue()
    assert len(salida) <= PRIMER_FRAGMENTO_PLANO
    assert original.startswith(salida)


def test_cortar_el_ultimo_fragmento_se_detecta(llave: tink.KeysetHandle, datos: bytes) -> None:
    texto_cifrado = _cifrar(_tres_fragmentos_y_medio(), llave, datos)
    # Se corta justo en el borde de un fragmento: sin la marca de último fragmento, Tink falla.
    with pytest.raises(tink.TinkError):
        _descifrar(texto_cifrado[: 3 * FRAGMENTO], llave, datos)


def test_reordenar_fragmentos_se_detecta(llave: tink.KeysetHandle, datos: bytes) -> None:
    texto_cifrado = _cifrar(_tres_fragmentos_y_medio(), llave, datos)
    segundo = texto_cifrado[FRAGMENTO : 2 * FRAGMENTO]
    tercero = texto_cifrado[2 * FRAGMENTO : 3 * FRAGMENTO]
    reordenado = texto_cifrado[:FRAGMENTO] + tercero + segundo + texto_cifrado[3 * FRAGMENTO :]
    with pytest.raises(tink.TinkError):
        _descifrar(reordenado, llave, datos)


def test_datos_asociados_de_otro_caso_no_descifran(llave: tink.KeysetHandle, datos: bytes) -> None:
    texto_cifrado = _cifrar(b"extracto bancario", llave, datos)
    otro_caso = ct.datos_asociados(uuid.uuid7(), uuid.uuid7())
    with pytest.raises(tink.TinkError):
        _descifrar(texto_cifrado, llave, otro_caso)


# C4: llave de caso envuelta


def test_la_llave_envuelta_se_recupera_y_descifra(
    llave: tink.KeysetHandle, datos: bytes, maestra: rsa.RSAPrivateKey
) -> None:
    envuelta = ct.envolver(llave, maestra.public_key())
    texto_cifrado = _cifrar(b"historia clinica", llave, datos)

    recuperada = ct.desenvolver(envuelta, maestra)

    assert len(envuelta) == 384  # RSA de 3072 bits: el resultado mide lo mismo que el módulo
    assert _descifrar(texto_cifrado, recuperada, datos) == b"historia clinica"


def test_la_llave_envuelta_alterada_se_rechaza(
    llave: tink.KeysetHandle, maestra: rsa.RSAPrivateKey
) -> None:
    envuelta = bytearray(ct.envolver(llave, maestra.public_key()))
    envuelta[10] ^= 0x01
    with pytest.raises(ValueError, match="Decryption failed"):
        ct.desenvolver(bytes(envuelta), maestra)


def test_sin_la_llave_del_caso_no_se_lee(llave: tink.KeysetHandle, datos: bytes) -> None:
    texto_cifrado = _cifrar(b"chat de whatsapp", llave, datos)
    otra_llave = ct.nueva_llave_de_caso()
    with pytest.raises(tink.TinkError):
        _descifrar(texto_cifrado, otra_llave, datos)


def test_la_huella_es_la_del_original(llave: tink.KeysetHandle, datos: bytes) -> None:
    original = os.urandom(5000)
    huella = ct.cifrar(io.BytesIO(original), _Memoria(), llave, datos)
    assert huella == hashlib.sha256(original).hexdigest()
