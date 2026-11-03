"""Consultas sobre la cola de tareas en segundo plano (DAT-18)."""

import datetime
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import delete, func, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import Job


@dataclass(frozen=True, slots=True)
class ClaimedJob:
    """Una tarea tomada por el trabajador. attempts sirve de ficha: solo quien la tomó en ese
    intento puede cerrarla."""

    id: uuid.UUID
    kind: str
    payload: dict[str, Any]
    attempts: int
    status: str


# Toma la tarea pendiente más antigua sin esperar a las que otro trabajador ya tiene
# (SKIP LOCKED) y la reserva por lease. Una tarea en curso con la reserva vencida vuelve a
# tomarse; si ya iba en su último intento, se entierra en lugar de repetirse sin fin.
_CLAIM = text(
    """
    UPDATE jobs SET
        status = CASE WHEN attempts >= :max_attempts THEN 'dead' ELSE 'running' END,
        attempts = CASE WHEN attempts >= :max_attempts THEN attempts ELSE attempts + 1 END,
        run_after = now() + :lease,
        last_error = CASE
            WHEN attempts >= :max_attempts THEN :expired_error
            ELSE last_error
        END
    WHERE id = (
        SELECT id FROM jobs
        WHERE status IN ('queued', 'running') AND run_after <= now()
        ORDER BY run_after
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING id, kind, payload, attempts, status
    """
)


def insert_job(
    session: Session,
    kind: str,
    payload: dict[str, Any],
    idempotency_key: str,
    delay: datetime.timedelta,
) -> None:
    """Encola una tarea; si ya existe una con la misma clave, no hace nada."""
    statement = (
        insert(Job)
        .values(
            kind=kind,
            payload=payload,
            idempotency_key=idempotency_key,
            run_after=func.now() + delay,
        )
        .on_conflict_do_nothing(index_elements=[Job.idempotency_key])
    )
    session.execute(statement)


def claim_next(
    session: Session, max_attempts: int, lease: datetime.timedelta, expired_error: str
) -> ClaimedJob | None:
    """Toma la siguiente tarea pendiente, o None si no hay ninguna lista."""
    row = (
        session.execute(
            _CLAIM,
            {"max_attempts": max_attempts, "lease": lease, "expired_error": expired_error},
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        return None
    return ClaimedJob(
        id=row["id"],
        kind=row["kind"],
        payload=row["payload"],
        attempts=row["attempts"],
        status=row["status"],
    )


def _owned(job: ClaimedJob) -> Any:
    # Solo el intento que tomó la tarea la cierra: si su reserva venció y otro trabajador la
    # retomó, attempts ya cambió y esta actualización no toca nada.
    return (Job.id == job.id) & (Job.status == "running") & (Job.attempts == job.attempts)


def mark_done(session: Session, job: ClaimedJob) -> bool:
    """Marca la tarea como terminada; False si este intento ya no era su dueño."""
    result = session.scalars(
        update(Job).where(_owned(job)).values(status="done", last_error=None).returning(Job.id)
    ).all()
    return len(result) == 1


def mark_failed(
    session: Session, job: ClaimedJob, error: str, retry_in: datetime.timedelta | None
) -> bool:
    """Devuelve la tarea a la cola tras retry_in, o la entierra si retry_in es None."""
    values: dict[str, Any] = {"last_error": error[:500]}
    if retry_in is None:
        values["status"] = "dead"
    else:
        values["status"] = "queued"
        values["run_after"] = func.now() + retry_in
    result = session.scalars(
        update(Job).where(_owned(job)).values(**values).returning(Job.id)
    ).all()
    return len(result) == 1


def delete_finished_before(session: Session, boundary: uuid.UUID) -> int:
    """Borra las tareas terminadas o enterradas creadas antes del UUID v7 dado."""
    deleted = session.scalars(
        delete(Job).where(Job.status.in_(("done", "dead")), Job.id < boundary).returning(Job.id)
    ).all()
    return len(deleted)
