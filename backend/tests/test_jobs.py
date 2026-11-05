"""Pruebas de la cola de tareas: encolar, reglas de reintento y fechas por UUID v7."""

import datetime
import uuid
from typing import Any

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.adapters.email import OutgoingEmail
from app.core.config import Settings
from app.models import Job
from app.services import jobs
from app.services.jobs import enqueue, retry_delay, uuid7_floor
from app.services.notifications import EMAIL_BUILDERS, email_template


def _count(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Job)) or 0


def test_encolar_dos_veces_la_misma_clave_crea_una_sola_tarea(db: Session) -> None:
    payload = {"template": "email_verification", "user_id": str(uuid.uuid7())}
    enqueue(db, "email_send", payload, "verificacion:1")
    enqueue(db, "email_send", payload, "verificacion:1")

    assert _count(db) == 1


def test_una_tarea_diferida_espera_su_turno(db: Session) -> None:
    enqueue(db, "email_send", {}, "diferida", delay=datetime.timedelta(minutes=10))

    run_after = db.scalar(select(Job.run_after - func.now()))
    assert run_after == datetime.timedelta(minutes=10)


@pytest.mark.parametrize(
    ("kind", "payload", "error"),
    [
        ("enviar_fax", {}, ValueError),
        ("email_send", {"Plantilla": "x"}, ValueError),
        ("email_send", {"cuerpo": "x" * 101}, ValueError),
        ("email_send", {"datos": {"correo": "abogada@example.com"}}, TypeError),
        ("email_send", {f"clave_{n}": n for n in range(11)}, ValueError),
    ],
)
def test_el_payload_solo_admite_identificadores_y_valores_cortos(
    db: Session, kind: str, payload: dict[str, object], error: type[Exception]
) -> None:
    with pytest.raises(error):
        enqueue(db, kind, payload, "invalida")
    assert _count(db) == 0


def test_los_reintentos_esperan_cada_vez_el_doble() -> None:
    assert [retry_delay(attempt) for attempt in (1, 2, 3, 4)] == [
        datetime.timedelta(seconds=30),
        datetime.timedelta(minutes=1),
        datetime.timedelta(minutes=2),
        datetime.timedelta(minutes=4),
    ]
    assert retry_delay(jobs.MAX_ATTEMPTS) is None
    with pytest.raises(ValueError, match="primer intento"):
        retry_delay(0)


def test_uuid7_floor_separa_los_ids_por_fecha() -> None:
    now = datetime.datetime.now(datetime.UTC)
    created = uuid.uuid7()

    assert uuid7_floor(now - datetime.timedelta(seconds=1)) < created
    assert created < uuid7_floor(now + datetime.timedelta(seconds=1))
    assert uuid7_floor(now).version == 7


def test_una_plantilla_no_se_registra_dos_veces(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.notifications.EMAIL_BUILDERS", dict(EMAIL_BUILDERS))

    @email_template("prueba_unica")
    def primera(_session: Session, _payload: dict[str, Any], _settings: Settings) -> OutgoingEmail:
        return OutgoingEmail(to="abogada@example.com", subject="Aviso", text="Texto")

    with pytest.raises(ValueError, match="ya está registrada"):
        email_template("prueba_unica")(primera)
