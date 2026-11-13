"""Llave de cifrado por flujos de cada caso.

Cada caso tiene su propio keyset de Tink (AES-256-GCM-HKDF en fragmentos de 1 MiB). Se
guarda serializado y envuelto por el `KeyWrapper` (KMS o llave local); la llave en claro
solo existe en memoria durante la llamada y nunca se registra.
"""

import tink
from tink import proto_keyset_format, secret_key_access, streaming_aead

from app.adapters.keys import KeyWrapper, WrappedKey

streaming_aead.register()


def new_wrapped_case_key(wrapper: KeyWrapper) -> WrappedKey:
    """Genera la llave de un caso nuevo y la devuelve envuelta, lista para guardar."""
    handle = tink.new_keyset_handle(streaming_aead.streaming_aead_key_templates.AES256_GCM_HKDF_1MB)
    serializado: bytes = proto_keyset_format.serialize(handle, secret_key_access.TOKEN)
    return wrapper.wrap(serializado)


def open_case_key(wrapper: KeyWrapper, wrapped: WrappedKey) -> tink.KeysetHandle:
    """Desenvuelve la llave de un caso y la devuelve lista para cifrar o descifrar."""
    serializado = wrapper.unwrap(wrapped)
    return proto_keyset_format.parse(serializado, secret_key_access.TOKEN)
