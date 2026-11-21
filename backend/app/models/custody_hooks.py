"""Programación atómica del anclaje periódico al insertar custodia."""

import datetime
import uuid
from typing import Any

from sqlalchemy import event
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import Connection

from app.models.evidence import CustodyEvent
from app.models.jobs import Job


@event.listens_for(CustodyEvent, "after_insert")
def schedule_custody_anchor(_mapper: Any, connection: Connection, event_row: CustodyEvent) -> None:
    """El evento y su tarea nacen o se deshacen juntos; la clave evita duplicados."""
    connection.execute(
        insert(Job)
        .values(
            id=uuid.uuid7(),
            kind="custody_anchor",
            payload={
                "case_id": str(event_row.case_id),
                "organization_id": str(event_row.organization_id),
            },
            idempotency_key=f"custody_anchor:{event_row.case_id}:{event_row.seq}",
            run_after=event_row.occurred_at + datetime.timedelta(days=1),
        )
        .on_conflict_do_nothing(index_elements=[Job.idempotency_key])
    )
