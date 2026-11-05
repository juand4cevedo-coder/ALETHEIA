"""Pruebas del trabajador: toma, ejecución, reintentos, reservas vencidas y mantenimiento.

El trabajador abre sus propias transacciones, así que estas pruebas confirman sus datos en la
base de pruebas y vacían jobs antes y después de cada una.
"""

import datetime
import threading
import uuid
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import Engine, create_engine, delete, select
from sqlalchemy.orm import Session

from app.adapters.email import EmailDeliveryError, OutgoingEmail, SmtpEmailSender
from app.core.config import Settings
from app.models import Job, RateLimitEvent
from app.repositories import jobs as jobs_repository
from app.services import jobs, notifications
from app.services.jobs import uuid7_floor
from app.worker import __main__ as worker_main
from app.worker import heartbeat as worker_heartbeat
from app.worker.handlers import WorkerContext
from app.worker.runner import Worker
from tests.conftest import TEST_SIGNING_KEY
from tests.test_email import _delivered, _recipient

_PLANTILLA = "prueba_trabajador"
# Configuración para las plantillas: la base no se usa aquí, el trabajador recibe su motor aparte.
_SETTINGS = Settings.model_validate(
    {
        "environment": "test",
        "log_level": "INFO",
        "database_url": "postgresql+psycopg://aletheia_app@127.0.0.1:5432/aletheia_test",
        "token_signing_key": TEST_SIGNING_KEY,
    }
)


class FakeEmailSender:
    """Guarda lo que se envía, o falla con el error que se le indique."""

    def __init__(self, error: Exception | None = None) -> None:
        self.sent: list[OutgoingEmail] = []
        self.error = error

    def send(self, email: OutgoingEmail) -> None:
        if self.error is not None:
            raise self.error
        self.sent.append(email)


@pytest.fixture
def engine(app_engine: Engine, migrated_database: None) -> Iterator[Engine]:
    with Session(app_engine) as session, session.begin():
        session.execute(delete(Job))
    yield app_engine
    with Session(app_engine) as session, session.begin():
        session.execute(delete(Job))


@pytest.fixture(autouse=True)
def plantilla(monkeypatch: pytest.MonkeyPatch) -> None:
    def build(_session: Session, payload: dict[str, Any], _settings: Settings) -> OutgoingEmail:
        return OutgoingEmail(to=payload["to"], subject="Aviso de prueba", text="Texto")

    monkeypatch.setitem(notifications.EMAIL_BUILDERS, _PLANTILLA, build)


def _add(engine: Engine, **values: Any) -> uuid.UUID:
    job = Job(
        kind=values.pop("kind", "email_send"),
        payload=values.pop("payload", {"template": _PLANTILLA, "to": "abogada@example.com"}),
        idempotency_key=values.pop("idempotency_key", str(uuid.uuid7())),
        **values,
    )
    with Session(engine) as session, session.begin():
        session.add(job)
        session.flush()
        return job.id


def _job(engine: Engine, job_id: uuid.UUID) -> Job:
    with Session(engine) as session:
        job = session.get(Job, job_id)
        assert job is not None
        session.expunge(job)
        return job


def _worker(engine: Engine, sender: FakeEmailSender | None = None) -> Worker:
    return Worker(engine, WorkerContext(email=sender or FakeEmailSender(), settings=_SETTINGS))


# --- Ejecución --------------------------------------------------------------------------


def test_sin_tareas_no_hace_nada(engine: Engine) -> None:
    assert _worker(engine).run_once() is False


def test_envia_el_correo_y_cierra_la_tarea(engine: Engine) -> None:
    sender = FakeEmailSender()
    job_id = _add(engine)

    assert _worker(engine, sender).run_once() is True

    assert [email.to for email in sender.sent] == ["abogada@example.com"]
    job = _job(engine, job_id)
    assert (job.status, job.attempts, job.last_error) == ("done", 1, None)


def test_una_tarea_futura_no_se_toma_antes_de_tiempo(engine: Engine) -> None:
    _add(engine, run_after=datetime.datetime.now(datetime.UTC) + datetime.timedelta(minutes=5))

    assert _worker(engine).run_once() is False


def test_el_correo_llega_a_mailpit_de_punta_a_punta(engine: Engine, settings: Settings) -> None:
    recipient = _recipient()
    with Session(engine) as session, session.begin():
        jobs.enqueue(
            session, "email_send", {"template": _PLANTILLA, "to": recipient}, f"e2e:{recipient}"
        )

    sender = SmtpEmailSender(settings.smtp_host, settings.smtp_port)
    assert Worker(engine, WorkerContext(email=sender, settings=_SETTINGS)).run_once() is True
    assert _delivered(recipient)["Subject"] == "Aviso de prueba"


# --- Fallas y reintentos ----------------------------------------------------------------


def test_una_falla_pasajera_vuelve_a_la_cola_con_espera(engine: Engine) -> None:
    sender = FakeEmailSender(
        EmailDeliveryError("Amazon SES no aceptó el correo (Throttling).", permanent=False)
    )
    job_id = _add(engine)

    _worker(engine, sender).run_once()

    job = _job(engine, job_id)
    assert (job.status, job.attempts) == ("queued", 1)
    assert job.last_error == "EmailDeliveryError: Amazon SES no aceptó el correo (Throttling)."
    remaining = (job.run_after - datetime.datetime.now(datetime.UTC)).total_seconds()
    assert 25 <= remaining <= 31


def test_una_falla_permanente_entierra_la_tarea(engine: Engine) -> None:
    sender = FakeEmailSender(
        EmailDeliveryError("Amazon SES no aceptó el correo (MessageRejected).", permanent=True)
    )
    job_id = _add(engine)

    _worker(engine, sender).run_once()

    job = _job(engine, job_id)
    assert job.status == "dead"
    assert job.last_error is not None
    assert "MessageRejected" in job.last_error


def test_el_quinto_intento_fallido_entierra_la_tarea(engine: Engine) -> None:
    sender = FakeEmailSender(
        EmailDeliveryError("Sin red (EndpointConnectionError).", permanent=False)
    )
    job_id = _add(engine, attempts=jobs.MAX_ATTEMPTS - 1)

    _worker(engine, sender).run_once()

    job = _job(engine, job_id)
    assert (job.status, job.attempts) == ("dead", jobs.MAX_ATTEMPTS)


def test_una_plantilla_desconocida_entierra_la_tarea(engine: Engine) -> None:
    job_id = _add(engine, payload={"template": "no_existe"})

    _worker(engine).run_once()

    job = _job(engine, job_id)
    assert job.status == "dead"
    assert job.last_error == "PermanentJobError: Plantilla de correo desconocida: 'no_existe'."


def test_un_tipo_sin_manejador_entierra_la_tarea(engine: Engine) -> None:
    job_id = _add(engine, kind="tsa_stamp", payload={"evidence_id": str(uuid.uuid7())})

    _worker(engine).run_once()

    assert _job(engine, job_id).status == "dead"


def test_de_un_error_ajeno_solo_se_guarda_el_tipo(engine: Engine) -> None:
    sender = FakeEmailSender(RuntimeError("no se pudo enviar a abogada@example.com"))
    job_id = _add(engine)

    _worker(engine, sender).run_once()

    assert _job(engine, job_id).last_error == "RuntimeError"


# --- Reservas vencidas ------------------------------------------------------------------


def test_una_reserva_vencida_se_retoma(engine: Engine) -> None:
    # El trabajador anterior se cayó a mitad de la tarea: su reserva venció hace un minuto.
    sender = FakeEmailSender()
    job_id = _add(
        engine,
        status="running",
        attempts=1,
        run_after=datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=1),
    )

    assert _worker(engine, sender).run_once() is True

    job = _job(engine, job_id)
    assert (job.status, job.attempts) == ("done", 2)
    assert len(sender.sent) == 1


def test_una_reserva_vencida_en_el_ultimo_intento_no_se_repite(engine: Engine) -> None:
    sender = FakeEmailSender()
    job_id = _add(
        engine,
        status="running",
        attempts=jobs.MAX_ATTEMPTS,
        run_after=datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=1),
    )

    assert _worker(engine, sender).run_once() is True

    job = _job(engine, job_id)
    assert job.status == "dead"
    assert job.last_error == "La reserva venció en el último intento."
    assert sender.sent == []


def test_quien_perdio_la_reserva_no_cierra_la_tarea(engine: Engine) -> None:
    job_id = _add(engine)
    with Session(engine) as session, session.begin():
        claimed = jobs_repository.claim_next(session, jobs.MAX_ATTEMPTS, jobs.LEASE, "vencida")
    assert claimed is not None
    # Otro trabajador la retomó: ya va en el intento 2.
    with Session(engine) as session, session.begin():
        session.get_one(Job, job_id).attempts = 2

    with Session(engine) as session, session.begin():
        assert jobs_repository.mark_done(session, claimed) is False
    assert _job(engine, job_id).status == "running"


def test_varios_trabajadores_no_repiten_ninguna_tarea(engine: Engine) -> None:
    ids = {_add(engine) for _ in range(12)}
    sender = FakeEmailSender()
    seen: list[uuid.UUID] = []
    original = Worker._execute

    def spy(self: Worker, job: jobs_repository.ClaimedJob) -> None:
        seen.append(job.id)
        original(self, job)

    def drain() -> None:
        worker = _worker(engine, sender)
        while worker.run_once():
            pass

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(Worker, "_execute", spy)
        threads = [threading.Thread(target=drain) for _ in range(3)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)

    assert sorted(seen) == sorted(ids)
    assert len(sender.sent) == 12


# --- Mantenimiento y ciclo --------------------------------------------------------------


def test_el_mantenimiento_borra_lo_viejo_y_conserva_lo_reciente(engine: Engine) -> None:
    old = uuid7_floor(datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=31))
    viejo_terminado = _add(engine, id=old, status="done")
    reciente = _add(engine, status="done")
    viejo_pendiente = _add(engine, id=uuid.UUID(int=old.int + 1), status="queued")
    with Session(engine) as session, session.begin():
        session.add(
            RateLimitEvent(
                bucket="login_ip",
                key_hash=bytes(32),
                created_at=datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=1),
            )
        )

    now = [0.0]
    worker = Worker(
        engine, WorkerContext(email=FakeEmailSender(), settings=_SETTINGS), clock=lambda: now[0]
    )
    worker.maintain_if_due()

    with Session(engine) as session:
        remaining = set(session.scalars(select(Job.id)))
        limits = session.scalars(select(RateLimitEvent.id)).all()
    assert remaining == {reciente, viejo_pendiente}
    assert viejo_terminado not in remaining
    assert limits == []

    # Antes de 10 minutos no se repite.
    _add(engine, id=uuid.UUID(int=old.int + 2), status="dead")
    now[0] = 599.0
    worker.maintain_if_due()
    with Session(engine) as session:
        assert len(session.scalars(select(Job.id)).all()) == 3


def test_el_ciclo_late_y_se_detiene_al_pedirlo(engine: Engine, tmp_path: Path) -> None:
    heartbeat = tmp_path / "latido"
    stop = threading.Event()
    worker = Worker(
        engine, WorkerContext(email=FakeEmailSender(), settings=_SETTINGS), heartbeat=heartbeat
    )
    thread = threading.Thread(target=worker.run, args=(stop,))
    thread.start()
    try:
        thread.join(timeout=0.5)
        assert worker_heartbeat.is_fresh(heartbeat, max_age_seconds=5)
    finally:
        stop.set()
        thread.join(timeout=5)
    assert not thread.is_alive()


def test_sin_base_el_ciclo_sigue_vivo(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    # Puerto 9: nadie escucha. El ciclo registra el error y espera, sin caer el proceso.
    unreachable = create_engine(
        "postgresql+psycopg://aletheia_app:x@127.0.0.1:9/aletheia",
        connect_args={"connect_timeout": 1},
    )
    stop = threading.Event()
    worker = Worker(unreachable, WorkerContext(email=FakeEmailSender(), settings=_SETTINGS))
    thread = threading.Thread(target=worker.run, args=(stop,))
    thread.start()
    try:
        thread.join(timeout=3)
        assert thread.is_alive()
    finally:
        stop.set()
        thread.join(timeout=10)
        unreachable.dispose()
    assert any("La base de datos no responde" in r.getMessage() for r in caplog.records)


def test_la_revision_de_salud_mira_el_latido(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    heartbeat = tmp_path / "latido"
    monkeypatch.setattr(worker_heartbeat, "HEARTBEAT", heartbeat)

    assert worker_main.main(["--check"]) == 1
    heartbeat.touch()
    assert worker_main.main(["--check"]) == 0
