"""Tokens firmados (JWT con HS256) para los enlaces de un solo uso de los correos.

Cada uso tiene su propia subclave, derivada de la clave maestra con HMAC-SHA256: un token de
un uso nunca valida en otro, aunque los dos salgan del mismo secreto. Las sesiones de HU-007
derivan la suya de la misma clave.

Un enlace de un solo uso no se guarda en ninguna tabla. Lleva un sello del estado que su uso
cambia, como el correo todavía sin verificar o el hash de la contraseña, y deja de valer en
cuanto ese estado cambia.
"""

import datetime
import hashlib
import hmac
import uuid
from dataclasses import dataclass
from enum import StrEnum
from typing import Final

import jwt

_ALGORITHM: Final = "HS256"
_ISSUER: Final = "aletheia"
# Ningún token legítimo se acerca a este tamaño: lo que pase de aquí se descarta sin leerlo.
MAX_TOKEN_LENGTH: Final = 1024


class LinkPurpose(StrEnum):
    """Para qué sirve un enlace; va en el campo aud del token."""

    EMAIL_VERIFICATION = "email_verification"


class InvalidLinkError(Exception):
    """El enlace no sirve: mal formado, alterado, vencido, de otro uso o ya usado.

    Todas las causas dan el mismo error a propósito: quien prueba enlaces no aprende nada.
    """


@dataclass(frozen=True, slots=True)
class LinkClaims:
    """Lo que trae un enlace válido: de quién es y el sello del estado con que se emitió."""

    subject: uuid.UUID
    state_seal: str


def _subkey(master_key: str, use: str) -> bytes:
    return hmac.new(master_key.encode(), f"aletheia:{use}".encode(), hashlib.sha256).digest()


def _seal(key: bytes, state: str) -> str:
    # HMAC y no un SHA-256 simple: el token se puede leer (no está cifrado) y un SHA-256 del
    # correo se podría comparar contra una lista de correos conocidos.
    return hmac.new(key, state.encode(), hashlib.sha256).hexdigest()


def issue_link(
    master_key: str,
    purpose: LinkPurpose,
    subject: uuid.UUID,
    state: str,
    lifetime: datetime.timedelta,
    *,
    now: datetime.datetime | None = None,
) -> str:
    """Firma un enlace para subject, válido por lifetime y mientras state no cambie."""
    key = _subkey(master_key, f"link:{purpose}")
    issued_at = now or datetime.datetime.now(datetime.UTC)
    claims = {
        "iss": _ISSUER,
        "aud": purpose.value,
        "sub": str(subject),
        "iat": issued_at,
        "exp": issued_at + lifetime,
        "st": _seal(key, state),
    }
    return jwt.encode(claims, key, algorithm=_ALGORITHM)


def read_link(master_key: str, purpose: LinkPurpose, token: str) -> LinkClaims:
    """Comprueba firma, emisor, uso y vigencia, y devuelve el contenido del enlace."""
    if len(token) > MAX_TOKEN_LENGTH:
        raise InvalidLinkError
    key = _subkey(master_key, f"link:{purpose}")
    try:
        claims = jwt.decode(
            token,
            key,
            # Solo HS256: un token que diga "none" u otro algoritmo se rechaza.
            algorithms=[_ALGORITHM],
            audience=purpose.value,
            issuer=_ISSUER,
            options={"require": ["iss", "aud", "sub", "iat", "exp", "st"]},
        )
        return LinkClaims(subject=uuid.UUID(claims["sub"]), state_seal=str(claims["st"]))
    except jwt.PyJWTError, ValueError, TypeError:
        raise InvalidLinkError from None


def state_matches(master_key: str, purpose: LinkPurpose, claims: LinkClaims, state: str) -> bool:
    """Indica si el estado actual es el mismo con que se emitió el enlace."""
    expected = _seal(_subkey(master_key, f"link:{purpose}"), state)
    return hmac.compare_digest(expected, claims.state_seal)
