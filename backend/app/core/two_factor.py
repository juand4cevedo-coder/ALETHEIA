"""Segundo factor: contraseñas de un solo uso por tiempo (TOTP, RFC 6238) y códigos de respaldo.

Se usa SHA-1 con 6 dígitos y pasos de 30 segundos, que es lo que aceptan todas las aplicaciones
de autenticación (Google Authenticator, Microsoft Authenticator, Authy, 1Password). El secreto
se guarda cifrado con AES-GCM y una clave derivada de la clave maestra de la plataforma: una
copia de la base de datos sola no sirve para generar códigos.

Un código TOTP vale una sola vez: el paso (la ventana de 30 segundos) en que se aceptó queda
registrado y no se acepta otro igual ni anterior, así que ver o interceptar un código no
permite reutilizarlo.
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
import urllib.parse
from typing import Final

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

STEP_SECONDS: Final = 30
DIGITS: Final = 6
# Un paso antes y uno después: tolera un reloj atrasado o adelantado hasta 30 segundos.
WINDOW: Final = 1
_SECRET_BYTES: Final = 20
_NONCE_BYTES: Final = 12
RECOVERY_CODE_COUNT: Final = 10
ISSUER: Final = "ALETHEIA"
# Sin vocales ni caracteres que se confunden (0/O, 1/I): se leen y se teclean sin errores.
_RECOVERY_ALPHABET: Final = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


class InvalidSecretError(Exception):
    """El secreto guardado no se pudo descifrar."""


def new_secret() -> bytes:
    return secrets.token_bytes(_SECRET_BYTES)


def secret_to_base32(secret: bytes) -> str:
    return base64.b32encode(secret).decode().rstrip("=")


def provisioning_uri(secret: bytes, account: str) -> str:
    """El enlace otpauth:// que leen las aplicaciones de autenticación (con QR o al tocarlo)."""
    label = urllib.parse.quote(f"{ISSUER}:{account}", safe="")
    query = urllib.parse.urlencode(
        {
            "secret": secret_to_base32(secret),
            "issuer": ISSUER,
            "algorithm": "SHA1",
            "digits": DIGITS,
            "period": STEP_SECONDS,
        }
    )
    return f"otpauth://totp/{label}?{query}"


def current_step(now: float | None = None) -> int:
    return int((time.time() if now is None else now) // STEP_SECONDS)


def _code_for(secret: bytes, step: int) -> str:
    digest = hmac.new(secret, struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    binary = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(binary % 10**DIGITS).zfill(DIGITS)


def code_for(secret: bytes, step: int) -> str:
    """El código de un paso; lo usan las pruebas y quien necesite generarlo."""
    return _code_for(secret, step)


def normalize_code(value: str) -> str:
    """Quita espacios y guiones: las aplicaciones muestran «123 456» y la gente lo copia así."""
    return "".join(character for character in value if character not in " -").upper()


def verify_code(
    secret: bytes, code: str, *, after_step: int | None, now: float | None = None
) -> int | None:
    """Devuelve el paso en que el código es válido, o None.

    after_step es el último paso ya aceptado: un código de ese paso o de uno anterior no sirve.
    La comparación recorre siempre toda la ventana, sin cortar en el primer acierto.
    """
    candidate = normalize_code(code)
    if len(candidate) != DIGITS or not candidate.isdigit():
        return None
    center = current_step(now)
    matched: int | None = None
    for step in range(center - WINDOW, center + WINDOW + 1):
        if hmac.compare_digest(_code_for(secret, step), candidate) and (
            after_step is None or step > after_step
        ):
            matched = step
    return matched


def _key(master_key: str) -> bytes:
    return hmac.new(master_key.encode(), b"aletheia:two_factor:secret", hashlib.sha256).digest()


def encrypt_secret(master_key: str, secret: bytes) -> bytes:
    nonce = secrets.token_bytes(_NONCE_BYTES)
    return nonce + AESGCM(_key(master_key)).encrypt(nonce, secret, b"two_factor")


def decrypt_secret(master_key: str, stored: bytes) -> bytes:
    try:
        return AESGCM(_key(master_key)).decrypt(
            stored[:_NONCE_BYTES], stored[_NONCE_BYTES:], b"two_factor"
        )
    except InvalidTag, ValueError:
        raise InvalidSecretError from None


def new_recovery_codes() -> list[str]:
    """Diez códigos de un solo uso, con el formato XXXXX-XXXXX."""
    return [
        "".join(secrets.choice(_RECOVERY_ALPHABET) for _ in range(5))
        + "-"
        + "".join(secrets.choice(_RECOVERY_ALPHABET) for _ in range(5))
        for _ in range(RECOVERY_CODE_COUNT)
    ]


def recovery_code_hash(master_key: str, code: str) -> bytes:
    """El HMAC con que se guarda un código de respaldo.

    Los códigos tienen unos 50 bits de azar: un hash simple se podría probar por fuerza bruta si
    se filtrara la base. Con una clave del servidor, una copia de la base sola no basta.
    """
    key = hmac.new(master_key.encode(), b"aletheia:two_factor:recovery", hashlib.sha256).digest()
    return hmac.new(key, normalize_code(code).encode(), hashlib.sha256).digest()


def looks_like_recovery_code(value: str) -> bool:
    normalized = normalize_code(value)
    return len(normalized) == 10 and all(
        character in _RECOVERY_ALPHABET for character in normalized
    )
