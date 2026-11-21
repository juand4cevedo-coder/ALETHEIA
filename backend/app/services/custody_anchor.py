"""Anclaje RFC 3161 periódico de la cabeza de custodia, sin transacciones de red."""

import uuid
from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters.stamping import SelloDeTiempo, SelloInvalidoError, pedir_sello_de_tiempo
from app.db.tenancy import TenantContext, set_tenant
from app.models import Case, CustodyAnchor, CustodyEvent
from app.services.jobs import PermanentJobError


@dataclass(frozen=True, slots=True)
class PendingAnchor:
    seq: int
    head_hash: bytes


def _pending(
    session: Session, case_id: uuid.UUID, organization_id: uuid.UUID
) -> PendingAnchor | None:
    set_tenant(session, TenantContext(organization_id=organization_id))
    case = session.scalar(
        select(Case).where(Case.id == case_id, Case.organization_id == organization_id)
    )
    if case is None or case.status == "deleting" or case.custody_seq < 1:
        return None
    event_hash = session.scalar(
        select(CustodyEvent.event_hash).where(
            CustodyEvent.case_id == case.id, CustodyEvent.seq == case.custody_seq
        )
    )
    if event_hash is None:
        raise PermanentJobError("La cadena no tiene la cabeza declarada por el caso.")
    existing = session.scalar(
        select(CustodyAnchor.id).where(
            CustodyAnchor.case_id == case.id,
            CustodyAnchor.seq == case.custody_seq,
            CustodyAnchor.head_hash == event_hash,
        )
    )
    return None if existing is not None else PendingAnchor(case.custody_seq, event_hash)


def _store(
    session: Session,
    case_id: uuid.UUID,
    organization_id: uuid.UUID,
    pending: PendingAnchor,
    stamp: SelloDeTiempo,
) -> None:
    set_tenant(session, TenantContext(organization_id=organization_id))
    event_hash = session.scalar(
        select(CustodyEvent.event_hash).where(
            CustodyEvent.case_id == case_id, CustodyEvent.seq == pending.seq
        )
    )
    if event_hash != pending.head_hash:
        raise PermanentJobError("La cabeza cambió mientras se obtenía su sello.")
    existing = session.scalar(
        select(CustodyAnchor.id).where(
            CustodyAnchor.case_id == case_id, CustodyAnchor.seq == pending.seq
        )
    )
    if existing is None:
        session.add(
            CustodyAnchor(
                organization_id=organization_id,
                case_id=case_id,
                seq=pending.seq,
                head_hash=pending.head_hash,
                tsa_token=stamp.token,
                tsa_time=stamp.hora,
            )
        )


def anchor(
    open_session: Callable[[], Session],
    case_id: uuid.UUID,
    organization_id: uuid.UUID,
    stamp_head: Callable[[bytes], SelloDeTiempo] = pedir_sello_de_tiempo,
) -> None:
    with open_session() as session, session.begin():
        pending = _pending(session, case_id, organization_id)
    if pending is None:
        return
    try:
        stamp = stamp_head(pending.head_hash)
    except SelloInvalidoError as exc:
        raise PermanentJobError(str(exc)) from exc
    with open_session() as session, session.begin():
        _store(session, case_id, organization_id, pending, stamp)
