"""Verificación de persona por prueba de trabajo, sin servicios de terceros.

La API entrega un reto: una sal con su vencimiento, el SHA-256 de la sal seguida de un número
secreto entre 0 y `maxnumber`, y la firma HMAC del reto. El navegador prueba números hasta dar
con el que produce ese resumen (en promedio la mitad del rango) y devuelve la solución. Para
una persona es un cálculo de menos de un segundo en segundo plano; para quien automatiza miles
de envíos, un costo que crece con cada uno.

La firma impide inventar retos; el vencimiento, guardarlos para después; y la tabla
captcha_solutions, usar la misma solución dos veces. No se guarda nada en el navegador ni se
envía nada a otro sitio: es el mismo protocolo que ALTCHA, implementado aquí.
"""

import base64
import binascii
import datetime
import hashlib
import hmac
import json
import secrets
from dataclasses import dataclass
from typing import Final

from sqlalchemy import delete, func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import CaptchaSolution

ALGORITHM: Final = "SHA-256"
LIFETIME: Final = datetime.timedelta(minutes=10)
_CONTEXT: Final = b"aletheia-captcha-v1"


class CaptchaError(Exception):
    """La solución falta, está mal formada, no corresponde, venció o ya se usó."""


@dataclass(frozen=True, slots=True)
class Challenge:
    algorithm: str
    challenge: str
    maxnumber: int
    salt: str
    signature: str


def _key(signing_key: str) -> bytes:
    # Una clave propia derivada de la maestra: una firma de reto nunca sirve como otra firma.
    return hmac.new(signing_key.encode(), _CONTEXT, hashlib.sha256).digest()


def _sign(signing_key: str, challenge: str) -> str:
    return hmac.new(_key(signing_key), challenge.encode(), hashlib.sha256).hexdigest()


def _digest(salt: str, number: int) -> str:
    return hashlib.sha256(f"{salt}{number}".encode()).hexdigest()


def create(signing_key: str, maxnumber: int, now: datetime.datetime) -> Challenge:
    expires = int((now + LIFETIME).timestamp())
    salt = f"{secrets.token_hex(12)}?expires={expires}&"
    number = secrets.randbelow(maxnumber + 1)
    challenge = _digest(salt, number)
    return Challenge(
        algorithm=ALGORITHM,
        challenge=challenge,
        maxnumber=maxnumber,
        salt=salt,
        signature=_sign(signing_key, challenge),
    )


def _expiry(salt: str) -> datetime.datetime:
    try:
        stamp = int(salt.split("?expires=", 1)[1].rstrip("&"))
    except IndexError, ValueError:
        raise CaptchaError from None
    return datetime.datetime.fromtimestamp(stamp, datetime.UTC)


def verify(session: Session, signing_key: str, payload: str | None, now: datetime.datetime) -> None:
    """Comprueba la solución que mandó el navegador y la marca como usada."""
    if not payload:
        raise CaptchaError
    try:
        data = json.loads(base64.b64decode(payload, validate=True))
        algorithm, challenge, salt, signature = (
            str(data["algorithm"]),
            str(data["challenge"]),
            str(data["salt"]),
            str(data["signature"]),
        )
        number = int(data["number"])
    except binascii.Error, ValueError, KeyError, TypeError:
        raise CaptchaError from None
    if algorithm != ALGORITHM or number < 0:
        raise CaptchaError
    if not hmac.compare_digest(signature, _sign(signing_key, challenge)):
        raise CaptchaError
    if not hmac.compare_digest(challenge, _digest(salt, number)):
        raise CaptchaError
    expires_at = _expiry(salt)
    if expires_at <= now:
        raise CaptchaError
    used = session.execute(
        insert(CaptchaSolution)
        .values(challenge_hash=hashlib.sha256(challenge.encode()).digest(), expires_at=expires_at)
        .on_conflict_do_nothing()
        .returning(CaptchaSolution.challenge_hash)
    ).scalar_one_or_none()
    if used is None:
        raise CaptchaError


def purge_expired(session: Session) -> int:
    """Borra los retos vencidos: ya no se pueden reutilizar. Lo ejecuta el trabajador."""
    result = session.execute(delete(CaptchaSolution).where(CaptchaSolution.expires_at < func.now()))
    return int(getattr(result, "rowcount", 0) or 0)
