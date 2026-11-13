"""Pruebas de la llave de cifrado por flujos de cada caso."""

import io

import pytest
import tink
from cryptography.hazmat.primitives.asymmetric import rsa
from tink import streaming_aead

from app.adapters.keys import LocalKeyWrapper
from app.core.case_keys import new_wrapped_case_key, open_case_key

_DATOS = b"aletheia/prueba"


@pytest.fixture(scope="module")
def wrapper() -> LocalKeyWrapper:
    return LocalKeyWrapper(rsa.generate_private_key(public_exponent=65537, key_size=3072))


class _Destino(io.BytesIO):
    """BytesIO que conserva su contenido aunque Tink lo cierre al terminar."""

    def close(self) -> None:
        self.flush()


def _cifrar(handle: tink.KeysetHandle, contenido: bytes) -> bytes:
    primitiva = handle.primitive(streaming_aead.StreamingAead)
    destino = _Destino()
    with primitiva.new_encrypting_stream(destino, _DATOS) as cifrador:
        cifrador.write(contenido)
    return destino.getvalue()


def _descifrar(handle: tink.KeysetHandle, cifrado: bytes) -> bytes:
    primitiva = handle.primitive(streaming_aead.StreamingAead)
    with primitiva.new_decrypting_stream(io.BytesIO(cifrado), _DATOS) as descifrador:
        leido: bytes = descifrador.read()
    return leido


def test_la_llave_nueva_cifra_y_descifra_un_flujo(wrapper: LocalKeyWrapper) -> None:
    contenido = bytes(range(256)) * (3 * 1024 * 1024 // 256)
    handle = open_case_key(wrapper, new_wrapped_case_key(wrapper))

    cifrado = _cifrar(handle, contenido)

    assert cifrado != contenido
    assert _descifrar(handle, cifrado) == contenido


def test_dos_casos_no_comparten_llave(wrapper: LocalKeyWrapper) -> None:
    a = new_wrapped_case_key(wrapper)
    b = new_wrapped_case_key(wrapper)
    assert a.ciphertext != b.ciphertext

    cifrado = _cifrar(open_case_key(wrapper, a), b"contenido del caso A")

    with pytest.raises(tink.TinkError):
        _descifrar(open_case_key(wrapper, b), cifrado)
