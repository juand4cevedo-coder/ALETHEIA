"""Programación y sellado periódico de cabezas de custodia."""

import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters.stamping import SelloDeTiempo
from app.models import CaseMember, CustodyAnchor, CustodyEvent, Job
from app.services import custody_anchor
from tests.conftest import ZERO_HASH, Tenant, create_tenant


def _event(db: Session, tenant: Tenant, seq: int, previous: bytes) -> CustodyEvent:
    row = CustodyEvent(
        organization_id=tenant.organization_id,
        case_id=tenant.case_id,
        seq=seq,
        actor_user_id=tenant.user_id,
        action="case_created" if seq == 1 else "case_reopened",
        details={"seq": seq},
        occurred_at=datetime.datetime.now(datetime.UTC),
        prev_hash=previous,
    )
    db.add(row)
    db.flush()
    return row


def test_evento_programa_anclaje_y_el_trabajador_lo_guarda_una_vez(db: Session) -> None:
    tenant = create_tenant(db, "Anclaje diario")
    db.add(
        CaseMember(
            case_id=tenant.case_id,
            user_id=tenant.user_id,
            organization_id=tenant.organization_id,
            added_by=tenant.user_id,
        )
    )
    event = _event(db, tenant, 1, ZERO_HASH)
    expected_hash = event.event_hash
    expected_run_after = event.occurred_at + datetime.timedelta(days=1)
    db.commit()

    job = db.scalar(select(Job).where(Job.idempotency_key == f"custody_anchor:{tenant.case_id}:1"))
    assert job is not None
    assert job.kind == "custody_anchor"
    assert job.payload == {
        "case_id": str(tenant.case_id),
        "organization_id": str(tenant.organization_id),
    }
    assert job.run_after == expected_run_after
    db.commit()

    calls = 0

    def stamp(digest: bytes) -> SelloDeTiempo:
        nonlocal calls
        calls += 1
        assert digest == expected_hash
        return SelloDeTiempo(
            token=b"anclaje-diario",
            hora=datetime.datetime(2026, 11, 22, 10, tzinfo=datetime.UTC),
        )

    def open_session() -> Session:
        assert db.bind is not None
        return Session(db.bind)

    custody_anchor.anchor(open_session, tenant.case_id, tenant.organization_id, stamp_head=stamp)
    anchor = db.scalar(
        select(CustodyAnchor).where(CustodyAnchor.case_id == tenant.case_id, CustodyAnchor.seq == 1)
    )
    assert anchor is not None
    assert anchor.head_hash == expected_hash
    assert anchor.tsa_token == b"anclaje-diario"

    db.commit()
    custody_anchor.anchor(open_session, tenant.case_id, tenant.organization_id, stamp_head=stamp)
    assert calls == 1
