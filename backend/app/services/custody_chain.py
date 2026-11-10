"""Verificador independiente de la cadena de custodia (ADR-037, base de HU-024).

La base calcula el hash de cada evento al insertarlo (migración 0013). Este módulo repite el
cálculo por su cuenta, con hashlib, sobre los datos guardados: no usa ninguna función de la
base para decidir. Si alguien con acceso directo a PostgreSQL altera un evento, lo borra o lo
reordena, la cadena ya no cierra y el informe dice en qué evento se rompe.

La serialización canónica debe ser idéntica a custody_event_canonical; una prueba compara las
dos con cada tipo de dato. details llega como el texto canónico de JSONB (details::text), que es
lo que la base firma.
"""

import datetime
import hashlib
import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Final, Literal

from sqlalchemy import Text, cast, select
from sqlalchemy.orm import Session

from app.models import CustodyEvent

CANONICAL_VERSION: Final = "aletheia-custody-v1"
GENESIS_HASH: Final = bytes(32)
_NULL: Final = "-"

type BreakReason = Literal["sequence", "previous_hash", "event_hash"]


@dataclass(frozen=True, slots=True)
class ChainEvent:
    """Un evento tal como quedó guardado."""

    case_id: uuid.UUID
    seq: int
    evidence_id: uuid.UUID | None
    actor_user_id: uuid.UUID | None
    action: str
    details_text: str
    occurred_at: datetime.datetime
    prev_hash: bytes
    event_hash: bytes


@dataclass(frozen=True, slots=True)
class ChainReport:
    """Resultado de verificar la cadena de un caso (MSG-018)."""

    events_checked: int
    broken_at: int | None = None
    reason: BreakReason | None = None
    # Hash del último evento: lo que un anclaje externo firmaría (ADR-037).
    head_hash: bytes = GENESIS_HASH

    @property
    def intact(self) -> bool:
        """Si la cadena cierra de punta a punta."""
        return self.broken_at is None


def canonical(event: ChainEvent) -> bytes:
    """La serialización canónica, versión 1, en UTF-8."""
    occurred = event.occurred_at.astimezone(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    fields = (
        CANONICAL_VERSION,
        event.prev_hash.hex(),
        str(event.case_id),
        str(event.seq),
        str(event.evidence_id) if event.evidence_id is not None else _NULL,
        str(event.actor_user_id) if event.actor_user_id is not None else _NULL,
        event.action,
        occurred,
        event.details_text,
    )
    return "\n".join(fields).encode()


def event_digest(event: ChainEvent) -> bytes:
    """El SHA-256 que debe tener el evento según sus datos."""
    return hashlib.sha256(canonical(event)).digest()


def verify(events: Iterable[ChainEvent]) -> ChainReport:
    """Recorre la cadena en orden y devuelve el primer evento que no cierra, si hay alguno.

    Comprueba tres cosas en cada evento: que siga al anterior sin huecos, que traiga el hash
    del anterior y que su propio hash corresponda a sus datos.
    """
    expected_prev = GENESIS_HASH
    checked = 0
    for checked, event in enumerate(events, start=1):
        if event.seq != checked:
            return ChainReport(checked - 1, event.seq, "sequence", expected_prev)
        if event.prev_hash != expected_prev:
            return ChainReport(checked - 1, event.seq, "previous_hash", expected_prev)
        if event.event_hash != event_digest(event):
            return ChainReport(checked - 1, event.seq, "event_hash", expected_prev)
        expected_prev = event.event_hash
    return ChainReport(checked, head_hash=expected_prev)


def load(session: Session, case_id: uuid.UUID) -> list[ChainEvent]:
    """Los eventos del caso en orden, con details en el texto canónico que firma la base.

    Row-Level Security deja ver solo los casos de la organización de la sesión.
    """
    statement = (
        select(
            CustodyEvent.case_id,
            CustodyEvent.seq,
            CustodyEvent.evidence_id,
            CustodyEvent.actor_user_id,
            CustodyEvent.action,
            cast(CustodyEvent.details, Text),
            CustodyEvent.occurred_at,
            CustodyEvent.prev_hash,
            CustodyEvent.event_hash,
        )
        .where(CustodyEvent.case_id == case_id)
        .order_by(CustodyEvent.seq)
    )
    return [ChainEvent(*row) for row in session.execute(statement)]
