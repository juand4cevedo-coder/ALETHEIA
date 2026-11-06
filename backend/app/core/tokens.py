"""Tokens firmados (JWT con HS256): los enlaces de un solo uso de los correos y el acceso de
las sesiones.

Cada uso tiene su propia subclave, derivada de la clave maestra con HMAC-SHA256: un token de
un uso nunca valida en otro, aunque todos salgan del mismo secreto (ADR-027).

Un enlace de un solo uso no se guarda en ninguna tabla. Lleva un sello del estado que su uso
cambia, como el correo todavía sin verificar o el hash de la contraseña, y deja de valer en
cuanto ese estado cambia.

El token de acceso de una sesión dura 10 minutos y lleva la familia de la sesión (sid). La API
comprueba en cada petición que esa familia siga viva, así que cerrar las sesiones corta el
acceso de inmediato y no cuando el token vence (ADR-028).
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


_ACCESS_USE: Final = "session:access"
_ACCESS_AUDIENCE: Final = "session"


class LinkPurpose(StrEnum):
    """Para qué sirve un enlace; va en el campo aud del token."""

    EMAIL_VERIFICATION = "email_verification"
    ACCOUNT_RECOVERY = "account_recovery"


class InvalidLinkError(Exception):
    """El enlace no sirve: mal formado, alterado, vencido, de otro uso o ya usado.

    Todas las causas dan el mismo error a propósito: quien prueba enlaces no aprende nada.
    """


@dataclass(frozen=True, slots=True)
class LinkClaims:
    """Lo que trae un enlace válido: de quién es y el sello del estado con que se emitió."""

    subject: uuid.UUID
    state_seal: str


class InvalidAccessTokenError(Exception):
    """El token de acceso no sirve: falta, está mal formado, alterado o vencido."""


@dataclass(frozen=True, slots=True)
class AccessClaims:
    """Lo que trae un token de acceso válido: de quién es y a qué sesión pertenece."""

    subject: uuid.UUID
    session_id: uuid.UUID


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


def issue_access_token(
    master_key: str,
    subject: uuid.UUID,
    session_id: uuid.UUID,
    lifetime: datetime.timedelta,
    *,
    now: datetime.datetime | None = None,
) -> str:
    """Firma el acceso de subject a la sesión session_id, válido por lifetime."""
    issued_at = now or datetime.datetime.now(datetime.UTC)
    claims = {
        "iss": _ISSUER,
        "aud": _ACCESS_AUDIENCE,
        "sub": str(subject),
        "sid": str(session_id),
        "iat": issued_at,
        "exp": issued_at + lifetime,
    }
    return jwt.encode(claims, _subkey(master_key, _ACCESS_USE), algorithm=_ALGORITHM)


def read_access_token(master_key: str, token: str) -> AccessClaims:
    """Comprueba firma, emisor, uso y vigencia, y devuelve de quién es y su sesión."""
    if len(token) > MAX_TOKEN_LENGTH:
        raise InvalidAccessTokenError
    try:
        claims = jwt.decode(
            token,
            _subkey(master_key, _ACCESS_USE),
            algorithms=[_ALGORITHM],
            audience=_ACCESS_AUDIENCE,
            issuer=_ISSUER,
            options={"require": ["iss", "aud", "sub", "sid", "iat", "exp"]},
        )
        return AccessClaims(subject=uuid.UUID(claims["sub"]), session_id=uuid.UUID(claims["sid"]))
    except jwt.PyJWTError, ValueError, TypeError:
        raise InvalidAccessTokenError from None
