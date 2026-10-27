"""Referencia para ADR-014: qué detecta y qué no el cifrado por fragmentos hecho a mano."""

import io
import os
import uuid

import pytest
from cryptography.exceptions import InvalidTag

from spikes.tt006 import cifrado_cryptography as cc
from spikes.tt006 import cifrado_tink as ct

FRAGMENTO_CIFRADO = cc.FRAGMENTO_PLANO + 16
PREFIJO = 8


@pytest.fixture
def llave() -> bytes:
    return cc.nueva_llave()


@pytest.fixture
def datos() -> bytes:
    return ct.datos_asociados(uuid.uuid7(), uuid.uuid7())


def _cifrar(contenido: bytes, llave: bytes, datos: bytes) -> bytes:
    destino = io.BytesIO()
    cc.cifrar(io.BytesIO(contenido), destino, llave, datos)
    return destino.getvalue()


def _descifrar(texto_cifrado: bytes, llave: bytes, datos: bytes) -> bytes:
    destino = io.BytesIO()
    cc.descifrar(io.BytesIO(texto_cifrado), destino, llave, datos)
    return destino.getvalue()


def _tres_fragmentos_y_medio() -> bytes:
    return os.urandom(3 * cc.FRAGMENTO_PLANO + 100)


def test_ida_y_vuelta(llave: bytes, datos: bytes) -> None:
    original = _tres_fragmentos_y_medio()
    assert _descifrar(_cifrar(original, llave, datos), llave, datos) == original


def test_detecta_un_byte_alterado(llave: bytes, datos: bytes) -> None:
    alterado = bytearray(_cifrar(_tres_fragmentos_y_medio(), llave, datos))
    alterado[PREFIJO + FRAGMENTO_CIFRADO + 1000] ^= 0x01
    with pytest.raises(InvalidTag):
        _descifrar(bytes(alterado), llave, datos)


def test_detecta_fragmentos_reordenados(llave: bytes, datos: bytes) -> None:
    texto_cifrado = _cifrar(_tres_fragmentos_y_medio(), llave, datos)
    inicio = PREFIJO + FRAGMENTO_CIFRADO
    segundo = texto_cifrado[inicio : inicio + FRAGMENTO_CIFRADO]
    tercero = texto_cifrado[inicio + FRAGMENTO_CIFRADO : inicio + 2 * FRAGMENTO_CIFRADO]
    resto = texto_cifrado[inicio + 2 * FRAGMENTO_CIFRADO :]
    reordenado = texto_cifrado[:inicio] + tercero + segundo + resto
    with pytest.raises(InvalidTag):
        _descifrar(reordenado, llave, datos)


def test_no_detecta_el_corte_en_el_borde_de_un_fragmento(llave: bytes, datos: bytes) -> None:
    """El punto débil: sin marca de último fragmento, un archivo cortado pasa como válido.

    Corregirlo exige diseñar esa marca, que es justo la construcción que Tink ya trae
    probada. Por eso esta alternativa equivale a hacer criptografía propia.
    """
    original = _tres_fragmentos_y_medio()
    cortado = _cifrar(original, llave, datos)[: PREFIJO + 2 * FRAGMENTO_CIFRADO]

    recuperado = _descifrar(cortado, llave, datos)

    assert recuperado == original[: 2 * cc.FRAGMENTO_PLANO]
    assert len(recuperado) < len(original)
