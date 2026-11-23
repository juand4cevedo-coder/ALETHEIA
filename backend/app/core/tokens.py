"""Tokens de la API: los firmados (JWT con HS256) de los enlaces de la cuenta y del acceso de
las sesiones, y los opacos que se guardan como hash.

Cada uso firmado tiene su propia subclave, derivada de la clave maestra con HMAC-SHA256: un
token de un uso nunca valida en otro, aunque todos salgan del mismo secreto (ADR-027).

Un enlace firmado no se guarda en ninguna tabla. Lleva un sello del estado que su uso cambia,
como el correo todavía sin verificar o el security_stamp de la cuenta, y deja de valer en
cuanto ese estado cambia (ADR-027, ADR-034).

Un token opaco es un valor aleatorio sin contenido. La base guarda solo su SHA-256, así que
una copia de la base no sirve para usarlo. Se usa cuando cada token debe poder listarse o
revocarse uno por uno: los de renovación de las sesiones y las invitaciones (ADR-035).

El token de acceso de una sesión dura 10 minutos y lleva la familia de la sesión (sid). La API
comprueba en cada petición que esa familia siga viva, así que cerrar las sesiones corta el
acceso de inmediato y no cuando el token vence (ADR-028).
"""

import datetime
import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass
from enum import StrEnum
from typing import Final

import jwt

_ALGORITHM: Final = "HS256"
_ISSUER: Final = "aletheia"
# Ningún token legítimo se acerca a este tamaño: lo que pase de aquí se descarta sin leerlo.
MAX_TOKEN_LENGTH: Final = 1024
# 32 bytes aleatorios: 256 bits, imposibles de adivinar aunque se prueben sin límite.
_OPAQUE_TOKEN_BYTES: Final = 32


def new_opaque_token() -> str:
    """Un token opaco nuevo, en base64 apto para una URL."""
    return secrets.token_urlsafe(_OPAQUE_TOKEN_BYTES)


def opaque_token_hash(token: str) -> bytes:
    """El SHA-256 con que se guarda y se busca un token opaco. No necesita sal ni un hash
    lento: el token ya tiene 256 bits de azar, no es una contraseña que se pueda adivinar."""
    return hashlib.sha256(token.encode()).digest()


_ACCESS_USE: Final = "session:access"
_ACCESS_AUDIENCE: Final = "session"
_EXPORT_USE: Final = "link:export_download"
_EXPORT_AUDIENCE: Final = "export_download"
_GOOGLE_FLOW_USE: Final = "oauth:google"
_GOOGLE_FLOW_AUDIENCE: Final = "google_oauth"


class LinkPurpose(StrEnum):
    """Para qué sirve un enlace; va en el campo aud del token."""

    EMAIL_VERIFICATION = "email_verification"
    ACCOUNT_RECOVERY = "account_recovery"
    TWO_FACTOR_CHALLENGE = "two_factor_challenge"


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


@dataclass(frozen=True, slots=True)
class ExportDownloadClaims:
    """Identificadores firmados y sello de la huella, sin datos del expediente."""

    export_id: uuid.UUID
    organization_id: uuid.UUID
    state_seal: str


class InvalidExportLinkError(Exception):
    """El enlace no sirve, sin revelar si existe un paquete o de qué organización es."""


class InvalidGoogleFlowError(Exception):
    """La autorización de Google falta, fue alterada o venció."""


@dataclass(frozen=True, slots=True)
class GoogleFlowClaims:
    state: str
    nonce: str
    code_verifier: str
    mode: str
    user_id: uuid.UUID | None
    session_id: uuid.UUID | None
    account_type: str | None
    organization_name: str | None
    legal_version: str | None


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


def issue_google_flow(
    master_key: str,
    *,
    state: str,
    nonce: str,
    code_verifier: str,
    mode: str,
    user_id: uuid.UUID | None = None,
    session_id: uuid.UUID | None = None,
    account_type: str | None = None,
    organization_name: str | None = None,
    legal_version: str | None = None,
    now: datetime.datetime | None = None,
) -> str:
    """Firma el contexto corto que vuelve desde Google en una cookie HttpOnly."""
    issued_at = now or datetime.datetime.now(datetime.UTC)
    claims = {
        "iss": _ISSUER,
        "aud": _GOOGLE_FLOW_AUDIENCE,
        "iat": issued_at,
        "exp": issued_at + datetime.timedelta(minutes=10),
        "st": state,
        "nonce": nonce,
        "cv": code_verifier,
        "mode": mode,
    }
    if user_id is not None and session_id is not None:
        claims.update({"sub": str(user_id), "sid": str(session_id)})
    if mode == "register":
        claims.update({"account_type": account_type, "legal": legal_version})
        if organization_name is not None:
            claims["organization"] = organization_name
    return jwt.encode(claims, _subkey(master_key, _GOOGLE_FLOW_USE), algorithm=_ALGORITHM)


def read_google_flow(master_key: str, token: str) -> GoogleFlowClaims:
    if len(token) > MAX_TOKEN_LENGTH:
        raise InvalidGoogleFlowError
    try:
        claims = jwt.decode(
            token,
            _subkey(master_key, _GOOGLE_FLOW_USE),
            algorithms=[_ALGORITHM],
            audience=_GOOGLE_FLOW_AUDIENCE,
            issuer=_ISSUER,
            options={"require": ["iss", "aud", "iat", "exp", "st", "nonce", "cv", "mode"]},
        )
        user_id = uuid.UUID(claims["sub"]) if "sub" in claims else None
        session_id = uuid.UUID(claims["sid"]) if "sid" in claims else None
        mode = str(claims["mode"])
        account_type = str(claims["account_type"]) if "account_type" in claims else None
        organization_name = str(claims["organization"]) if "organization" in claims else None
        legal_version = str(claims["legal"]) if "legal" in claims else None
        valid_link = mode == "link" and user_id is not None and session_id is not None
        valid_login = mode == "login" and user_id is None and session_id is None
        valid_registration = (
            mode == "register"
            and user_id is None
            and session_id is None
            and account_type in {"individual", "firm"}
            and legal_version is not None
            and (
                (account_type == "individual" and organization_name is None)
                or (account_type == "firm" and organization_name is not None)
            )
        )
        if not (valid_login or valid_link or valid_registration):
            raise ValueError
        return GoogleFlowClaims(
            state=str(claims["st"]),
            nonce=str(claims["nonce"]),
            code_verifier=str(claims["cv"]),
            mode=mode,
            user_id=user_id,
            session_id=session_id,
            account_type=account_type,
            organization_name=organization_name,
            legal_version=legal_version,
        )
    except jwt.PyJWTError, ValueError, TypeError, KeyError:
        raise InvalidGoogleFlowError from None


def issue_export_download_link(
    master_key: str,
    export_id: uuid.UUID,
    organization_id: uuid.UUID,
    manifest_sha256: bytes,
    expires_at: datetime.datetime,
    *,
    now: datetime.datetime | None = None,
) -> str:
    """Firma un enlace transferible que no puede durar más que la fila `exports`."""
    issued_at = now or datetime.datetime.now(datetime.UTC)
    if (
        len(manifest_sha256) != 32
        or issued_at.tzinfo is None
        or issued_at.utcoffset() is None
        or expires_at.tzinfo is None
        or expires_at.utcoffset() is None
        or expires_at <= issued_at
    ):
        raise ValueError("Paquete sin huella válida o vencimiento futuro.")
    key = _subkey(master_key, _EXPORT_USE)
    claims = {
        "iss": _ISSUER,
        "aud": _EXPORT_AUDIENCE,
        "sub": str(export_id),
        "org": str(organization_id),
        "iat": issued_at,
        "exp": expires_at,
        "st": _seal(key, manifest_sha256.hex()),
    }
    return jwt.encode(claims, key, algorithm=_ALGORITHM)


def read_export_download_link(master_key: str, token: str) -> ExportDownloadClaims:
    """Comprueba firma, propósito, vigencia e identificadores antes de consultar la base."""
    if len(token) > MAX_TOKEN_LENGTH:
        raise InvalidExportLinkError
    try:
        claims = jwt.decode(
            token,
            _subkey(master_key, _EXPORT_USE),
            algorithms=[_ALGORITHM],
            audience=_EXPORT_AUDIENCE,
            issuer=_ISSUER,
            options={"require": ["iss", "aud", "sub", "org", "iat", "exp", "st"]},
        )
        return ExportDownloadClaims(
            export_id=uuid.UUID(claims["sub"]),
            organization_id=uuid.UUID(claims["org"]),
            state_seal=str(claims["st"]),
        )
    except jwt.PyJWTError, ValueError, TypeError:
        raise InvalidExportLinkError from None


def export_manifest_matches(
    master_key: str, claims: ExportDownloadClaims, manifest_sha256: bytes
) -> bool:
    """Invalida el enlace si el manifiesto fue reemplazado después de emitirlo."""
    if len(manifest_sha256) != 32:
        return False
    expected = _seal(_subkey(master_key, _EXPORT_USE), manifest_sha256.hex())
    return hmac.compare_digest(expected, claims.state_seal)


_SHARE_USE: Final = "link:evidence_share"
_SHARE_AUDIENCE: Final = "evidence_share"


class InvalidShareLinkError(Exception):
    """El enlace de evidencia falta, fue alterado o venció, sin decir cuál de las causas."""


@dataclass(frozen=True, slots=True)
class ShareLinkClaims:
    link_id: uuid.UUID
    organization_id: uuid.UUID
    evidence_id: uuid.UUID


def issue_share_link(
    master_key: str,
    link_id: uuid.UUID,
    organization_id: uuid.UUID,
    evidence_id: uuid.UUID,
    expires_at: datetime.datetime,
    *,
    now: datetime.datetime | None = None,
) -> str:
    """Firma un enlace a una sola evidencia. La fila `evidence_share_links` manda: revocarla lo
    invalida aunque la firma siga vigente."""
    issued_at = now or datetime.datetime.now(datetime.UTC)
    if expires_at.tzinfo is None or expires_at.utcoffset() is None or expires_at <= issued_at:
        raise ValueError("El enlace necesita un vencimiento futuro con zona horaria.")
    key = _subkey(master_key, _SHARE_USE)
    claims = {
        "iss": _ISSUER,
        "aud": _SHARE_AUDIENCE,
        "sub": str(link_id),
        "org": str(organization_id),
        "evd": str(evidence_id),
        "iat": issued_at,
        "exp": expires_at,
    }
    return jwt.encode(claims, key, algorithm=_ALGORITHM)


def read_share_link(master_key: str, token: str) -> ShareLinkClaims:
    if len(token) > MAX_TOKEN_LENGTH:
        raise InvalidShareLinkError
    try:
        claims = jwt.decode(
            token,
            _subkey(master_key, _SHARE_USE),
            algorithms=[_ALGORITHM],
            audience=_SHARE_AUDIENCE,
            issuer=_ISSUER,
            options={"require": ["iss", "aud", "sub", "org", "evd", "iat", "exp"]},
        )
        return ShareLinkClaims(
            link_id=uuid.UUID(claims["sub"]),
            organization_id=uuid.UUID(claims["org"]),
            evidence_id=uuid.UUID(claims["evd"]),
        )
    except jwt.PyJWTError, ValueError, TypeError, KeyError:
        raise InvalidShareLinkError from None
