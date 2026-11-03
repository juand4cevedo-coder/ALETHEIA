"""Ciclo del trabajador: toma una tarea de jobs, la ejecuta y decide si reintentar.

Cada paso va en su propia transacción corta: tomar la tarea, ejecutarla y cerrarla. Así una
tarea lenta nunca deja una transacción abierta sobre la cola, y si el proceso se cae a la mitad,
la reserva vence y otro intento la retoma.
"""

import datetime
import logging
import threading
import time
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Final

from sqlalchemy import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.adapters.email import EmailDeliveryError
from app.repositories import jobs as jobs_repository
from app.repositories.jobs import ClaimedJob
from app.services import rate_limit
from app.services.jobs import (
    LEASE,
    MAX_ATTEMPTS,
    PermanentJobError,
    purge_finished,
    retry_delay,
)
from app.worker.handlers import HANDLERS, Handler, WorkerContext

POLL_INTERVAL: Final = 2.0
MAINTENANCE_INTERVAL: Final = 600.0
_EXPIRED_ERROR: Final = "La reserva venció en el último intento."
# Errores propios: su mensaje lo escribimos nosotros y nunca lleva datos personales.
_OWN_ERRORS: Final = (PermanentJobError, EmailDeliveryError)

logger = logging.getLogger(__name__)


def _error_text(exc: Exception) -> str:
    """Lo que queda en last_error. De un error ajeno solo se guarda el tipo: su mensaje puede
    repetir un correo, un nombre o un valor de la consulta."""
    if isinstance(exc, _OWN_ERRORS):
        return f"{type(exc).__name__}: {exc}"
    return type(exc).__name__


class Worker:
    """Ejecuta las tareas de jobs de una en una."""

    def __init__(
        self,
        engine: Engine,
        context: WorkerContext,
        *,
        handlers: Mapping[str, Handler] = HANDLERS,
        heartbeat: Path | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._engine = engine
        self._context = context
        self._handlers = handlers
        self._heartbeat = heartbeat
        self._clock = clock
        self._next_maintenance = clock()

    def run(self, stop: threading.Event) -> None:
        """Trabaja hasta que stop se active; termina la tarea en curso antes de salir."""
        logger.info("Trabajador iniciado")
        while not stop.is_set():
            self._beat()
            self.maintain_if_due()
            try:
                worked = self.run_once()
            except SQLAlchemyError as exc:
                # Sin base no hay cola: se espera y se vuelve a intentar, sin caer el proceso.
                logger.error("La base de datos no responde: %s", type(exc).__name__)
                worked = False
            if not worked:
                stop.wait(POLL_INTERVAL)
        logger.info("Trabajador detenido")

    def run_once(self) -> bool:
        """Toma y ejecuta una tarea. False si no había ninguna lista."""
        with Session(self._engine) as session, session.begin():
            job = jobs_repository.claim_next(session, MAX_ATTEMPTS, LEASE, _EXPIRED_ERROR)
        if job is None:
            return False
        if job.status == "dead":
            logger.warning(
                "Tarea enterrada: su reserva venció en el último intento", extra=_log(job)
            )
            return True
        self._execute(job)
        return True

    def maintain_if_due(self) -> None:
        """Cada 10 minutos borra los intentos vencidos y las tareas viejas."""
        if self._clock() < self._next_maintenance:
            return
        self._next_maintenance = self._clock() + MAINTENANCE_INTERVAL
        try:
            with Session(self._engine) as session, session.begin():
                limits = rate_limit.purge_expired(session)
                jobs = purge_finished(session, datetime.datetime.now(datetime.UTC))
        except SQLAlchemyError as exc:
            logger.error("No se pudo hacer el mantenimiento: %s", type(exc).__name__)
            return
        logger.info("Mantenimiento: %d intentos y %d tareas borrados", limits, jobs)

    def _execute(self, job: ClaimedJob) -> None:
        handler = self._handlers.get(job.kind)
        try:
            if handler is None:
                msg = f"No hay manejador para {job.kind}."
                raise PermanentJobError(msg)
            with Session(self._engine) as session, session.begin():
                handler(session, job.payload, self._context)
        except Exception as exc:
            # Cualquier falla del manejador se registra y decide si la tarea se reintenta.
            self._fail(job, exc)
            return
        with Session(self._engine) as session, session.begin():
            closed = jobs_repository.mark_done(session, job)
        if closed:
            logger.info("Tarea terminada", extra=_log(job))
        else:
            logger.warning("La reserva venció antes de cerrar la tarea", extra=_log(job))

    def _fail(self, job: ClaimedJob, exc: Exception) -> None:
        retry_in = None if isinstance(exc, PermanentJobError) else retry_delay(job.attempts)
        with Session(self._engine) as session, session.begin():
            closed = jobs_repository.mark_failed(session, job, _error_text(exc), retry_in)
        if isinstance(exc, _OWN_ERRORS):
            # Falla prevista: el mensaje basta, la traza no aporta nada.
            logger.warning("Tarea fallida: %s", _error_text(exc), extra=_log(job))
        else:
            logger.error("Tarea fallida por un error inesperado", exc_info=exc, extra=_log(job))
        if not closed:
            logger.warning("La reserva venció antes de cerrar la tarea", extra=_log(job))
        elif retry_in is None:
            logger.warning("Tarea enterrada", extra=_log(job))

    def _beat(self) -> None:
        if self._heartbeat is not None:
            self._heartbeat.touch()


def _log(job: ClaimedJob) -> dict[str, object]:
    # Identificadores, nunca el payload.
    return {"job_id": str(job.id), "job_kind": job.kind, "attempt": job.attempts}


def heartbeat_is_fresh(path: Path, max_age_seconds: float) -> bool:
    """Indica si el trabajador dio señales de vida hace menos de max_age_seconds."""
    try:
        age = time.time() - path.stat().st_mtime
    except FileNotFoundError:
        return False
    return age < max_age_seconds
