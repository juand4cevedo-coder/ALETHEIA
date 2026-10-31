"""Operación: cola de tareas en segundo plano que atiende el trabajador."""

import datetime
from typing import Any, Final

from sqlalchemy import CheckConstraint, Index, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models._columns import UUIDv7Pk, text_values

# Tipos de tarea de la sección 9.5 del documento de Arquitectura (EVT-001 a EVT-008).
JOB_KINDS: Final = (
    "tsa_stamp",
    "export_build",
    "email_send",
    "case_purge",
    "payment_reconcile",
    "export_expire",
    "audit_anonymize",
    "subscription_expire",
)
JOB_STATUSES: Final = ("queued", "running", "done", "dead")


class Job(Base):
    """Tarea en segundo plano (DAT-18). Se entrega al menos una vez, así que cada tipo debe
    poder ejecutarse dos veces sin cambiar el resultado."""

    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint(text_values("kind", JOB_KINDS), name="kind"),
        CheckConstraint(
            "char_length(idempotency_key) BETWEEN 1 AND 200", name="idempotency_key_length"
        ),
        CheckConstraint(text_values("status", JOB_STATUSES), name="status"),
        CheckConstraint("attempts >= 0", name="attempts"),
        CheckConstraint("char_length(last_error) <= 500", name="last_error_length"),
        # El trabajador toma la siguiente tarea en cola sin recorrer las terminadas (IDX-010).
        Index("ix_jobs_run_after_queued", "run_after", postgresql_where=text("status = 'queued'")),
    )

    id: Mapped[UUIDv7Pk]
    kind: Mapped[str]
    # Solo identificadores: nunca contenido de casos ni datos personales.
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
    idempotency_key: Mapped[str] = mapped_column(unique=True)
    status: Mapped[str] = mapped_column(server_default="queued")
    attempts: Mapped[int] = mapped_column(server_default="0")
    # En cola: desde cuándo puede ejecutarse, con espera creciente entre intentos.
    # En curso: hasta cuándo dura la reserva del trabajador; si vence, la tarea vuelve a cola.
    run_after: Mapped[datetime.datetime] = mapped_column(server_default=func.now())
    last_error: Mapped[str | None]
