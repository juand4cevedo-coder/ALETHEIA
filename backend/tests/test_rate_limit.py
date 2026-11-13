"""Pruebas del límite de peticiones por cuenta y por IP (RN-026, RNF-006)."""

import datetime
import hashlib
import threading
import uuid
from collections.abc import Iterator
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from pydantic import TypeAdapter
from sqlalchemy import Engine, delete
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip
from app.core.config import Settings
from app.core.errors import PROBLEM_JSON
from app.main import create_app
from app.models import RateLimitEvent
from app.schemas.errors import Problem
from app.services import rate_limit
from app.services.rate_limit import (
    LOGIN_ACCOUNT,
    LOGIN_IP,
    Limit,
    RateLimitExceededError,
)

_CORREO = "abogada@example.com"


def _key(value: str) -> bytes:
    return hashlib.sha256(value.strip().lower().encode()).digest()


def _past_attempts(db: Session, limit: Limit, value: str, minutes_ago: float, count: int) -> None:
    moment = datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=minutes_ago)
    db.add_all(
        RateLimitEvent(bucket=limit.bucket, key_hash=_key(value), created_at=moment)
        for _ in range(count)
    )
    db.flush()


def _retry_after(db: Session, limit: Limit, value: str) -> int:
    with pytest.raises(RateLimitExceededError) as excinfo:
        rate_limit.check(db, limit, value)
    return excinfo.value.retry_after


def test_el_sexto_intento_fallido_de_una_cuenta_se_rechaza(db: Session) -> None:
    for _ in range(5):
        rate_limit.check(db, LOGIN_ACCOUNT, _CORREO)
        rate_limit.record(db, LOGIN_ACCOUNT, _CORREO)

    retry_after = _retry_after(db, LOGIN_ACCOUNT, _CORREO)
    assert 1 <= retry_after <= 15 * 60


def test_la_ip_admite_veinte_intentos(db: Session) -> None:
    for _ in range(20):
        rate_limit.hit(db, LOGIN_IP, "203.0.113.7")

    with pytest.raises(RateLimitExceededError):
        rate_limit.hit(db, LOGIN_IP, "203.0.113.7")


def test_los_intentos_fuera_de_la_ventana_no_cuentan(db: Session) -> None:
    _past_attempts(db, LOGIN_ACCOUNT, _CORREO, minutes_ago=16, count=5)

    rate_limit.check(db, LOGIN_ACCOUNT, _CORREO)


def test_la_ventana_es_deslizante(db: Session) -> None:
    # Cuatro intentos hace 14 minutos y uno hace un minuto: la cuenta está bloqueada y se
    # libera cuando vencen los de hace 14 minutos, es decir, en un minuto.
    _past_attempts(db, LOGIN_ACCOUNT, _CORREO, minutes_ago=14, count=4)
    _past_attempts(db, LOGIN_ACCOUNT, _CORREO, minutes_ago=1, count=1)

    assert 55 <= _retry_after(db, LOGIN_ACCOUNT, _CORREO) <= 61


def test_retry_after_dice_cuando_se_libera_la_cuenta(db: Session) -> None:
    _past_attempts(db, LOGIN_ACCOUNT, _CORREO, minutes_ago=10, count=5)

    assert 295 <= _retry_after(db, LOGIN_ACCOUNT, _CORREO) <= 301


def test_el_correo_se_compara_sin_mayusculas_ni_espacios(db: Session) -> None:
    _past_attempts(db, LOGIN_ACCOUNT, _CORREO, minutes_ago=1, count=5)

    with pytest.raises(RateLimitExceededError):
        rate_limit.check(db, LOGIN_ACCOUNT, "  Abogada@Example.COM ")


def test_cada_limite_y_cada_clave_cuentan_por_separado(db: Session) -> None:
    _past_attempts(db, LOGIN_ACCOUNT, _CORREO, minutes_ago=1, count=5)

    rate_limit.check(db, LOGIN_ACCOUNT, "otra@example.com")
    rate_limit.check(db, rate_limit.PASSWORD_RESET_ACCOUNT, _CORREO)


def test_check_no_registra_el_intento(db: Session) -> None:
    for _ in range(10):
        rate_limit.check(db, LOGIN_ACCOUNT, _CORREO)


def test_la_purga_borra_solo_los_intentos_vencidos(db: Session) -> None:
    _past_attempts(db, LOGIN_IP, "203.0.113.7", minutes_ago=20, count=2)
    _past_attempts(db, LOGIN_IP, "203.0.113.7", minutes_ago=1, count=1)

    assert rate_limit.purge_expired(db) == 2
    assert len(db.query(RateLimitEvent).all()) == 1


def test_dos_peticiones_simultaneas_no_comparten_el_ultimo_intento(
    app_engine: Engine, migrated_database: None
) -> None:
    # Con un solo intento libre, la segunda petición espera el candado de la primera y, cuando
    # la primera confirma su intento, la segunda recibe el 429.
    limit = Limit("login_account", 1, datetime.timedelta(minutes=15))
    correo = f"{uuid.uuid7()}@example.com"
    outcomes: list[str] = []

    def second_request() -> None:
        with Session(app_engine) as session:
            try:
                rate_limit.check(session, limit, correo)
                outcomes.append("pasó")
            except RateLimitExceededError:
                outcomes.append("429")

    first = Session(app_engine)
    try:
        rate_limit.check(first, limit, correo)
        thread = threading.Thread(target=second_request)
        thread.start()
        thread.join(timeout=0.5)
        assert thread.is_alive(), "la segunda petición debía esperar el candado"

        rate_limit.record(first, limit, correo)
        first.commit()
        thread.join(timeout=10)
        assert outcomes == ["429"]
    finally:
        first.close()
        with Session(app_engine) as cleanup:
            cleanup.execute(delete(RateLimitEvent).where(RateLimitEvent.key_hash == _key(correo)))
            cleanup.commit()


# --- Respuesta HTTP ---------------------------------------------------------------------

_PROBLEM = TypeAdapter(Problem)


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    app: FastAPI = create_app(settings)

    @app.get("/prueba/limite")
    def limite() -> None:
        raise RateLimitExceededError(120)

    @app.get("/prueba/ip")
    def ip(client_ip: Annotated[str, Depends(get_client_ip)]) -> str:
        return client_ip

    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


def test_el_limite_responde_429_con_retry_after(client: TestClient) -> None:
    response = client.get("/prueba/limite")

    assert response.status_code == 429
    assert response.headers["content-type"] == PROBLEM_JSON
    assert response.headers["retry-after"] == "120"
    assert response.headers["cache-control"] == "no-store"
    problem = _PROBLEM.validate_python(response.json())
    assert problem["title"] == "Too Many Requests"


def test_la_ip_del_cliente_llega_a_la_ruta(client: TestClient) -> None:
    assert client.get("/prueba/ip").json() == "testclient"
