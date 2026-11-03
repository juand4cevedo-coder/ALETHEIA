"""Pruebas de la tabla del límite de peticiones (DAT-19)."""

import hashlib

from psycopg.errors import CheckViolation, InsufficientPrivilege
from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.models import RateLimitEvent
from tests.conftest import rejected


def _key(value: str) -> bytes:
    return hashlib.sha256(value.encode()).digest()


def test_la_aplicacion_registra_cuenta_y_borra_intentos(db: Session) -> None:
    db.add_all(RateLimitEvent(bucket="login_ip", key_hash=_key("203.0.113.7")) for _ in range(3))
    db.flush()

    contados = db.scalar(
        select(func.count())
        .select_from(RateLimitEvent)
        .where(RateLimitEvent.bucket == "login_ip", RateLimitEvent.key_hash == _key("203.0.113.7"))
    )
    assert contados == 3

    db.execute(delete(RateLimitEvent).where(RateLimitEvent.bucket == "login_ip"))
    assert db.scalar(select(func.count()).select_from(RateLimitEvent)) == 0


def test_la_aplicacion_no_edita_un_intento(db: Session) -> None:
    db.add(RateLimitEvent(bucket="login_ip", key_hash=_key("203.0.113.7")))
    db.flush()

    with rejected(db, InsufficientPrivilege):
        db.execute(text("UPDATE rate_limit_events SET created_at = now() - interval '1 hour'"))


def test_la_clave_es_un_sha256_y_no_un_valor_en_claro(db: Session) -> None:
    with rejected(db, CheckViolation):
        db.add(RateLimitEvent(bucket="login_account", key_hash=b"abogada@example.com"))


def test_el_nombre_del_limite_tiene_un_formato_cerrado(db: Session) -> None:
    for bucket in ("", "Login", "login-ip", "1login", "x" * 41):
        with rejected(db, CheckViolation):
            db.add(RateLimitEvent(bucket=bucket, key_hash=_key("203.0.113.7")))
