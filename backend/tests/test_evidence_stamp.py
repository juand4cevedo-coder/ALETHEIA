"""El trabajador pide el sello de tiempo de una evidencia y registra el resultado una sola vez."""

import datetime

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters.stamping import SelloDeTiempo, SelloInvalidoError
from app.models import CustodyEvent, Evidence
from app.services import evidence_stamp
from app.services.jobs import PermanentJobError
from tests.conftest import add_evidence, create_tenant


def test_un_sello_valido_marca_la_evidencia_y_la_custodia(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    tenant = create_tenant(db, "Sello")
    evidence_id = add_evidence(db, tenant, b"contenido")
    db.commit()
    hora = datetime.datetime(2026, 11, 17, 12, 0, tzinfo=datetime.UTC)
    monkeypatch.setattr(
        evidence_stamp,
        "pedir_sello_de_tiempo",
        lambda _huella: SelloDeTiempo(token=b"sello-real", hora=hora),
    )

    evidence_stamp.stamp(lambda: db, evidence_id, tenant.case_id, tenant.organization_id)

    row = db.get(Evidence, evidence_id)
    assert row is not None
    assert row.tsa_status == "stamped"
    assert row.tsa_token == b"sello-real"
    assert row.tsa_time == hora
    event = db.scalar(
        select(CustodyEvent).where(
            CustodyEvent.case_id == tenant.case_id, CustodyEvent.action == "evidence_stamped"
        )
    )
    assert event is not None
    assert event.evidence_id == evidence_id


def test_un_sello_invalido_marca_la_evidencia_como_fallida_y_no_se_reintenta(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    tenant = create_tenant(db, "Sello fallido")
    evidence_id = add_evidence(db, tenant, b"contenido")
    db.commit()

    def falla(_huella: bytes) -> SelloDeTiempo:
        raise SelloInvalidoError("no verifica")

    monkeypatch.setattr(evidence_stamp, "pedir_sello_de_tiempo", falla)

    with pytest.raises(PermanentJobError):
        evidence_stamp.stamp(lambda: db, evidence_id, tenant.case_id, tenant.organization_id)

    row = db.get(Evidence, evidence_id)
    assert row is not None
    assert row.tsa_status == "failed"
    assert row.tsa_token is None
    event = db.scalar(
        select(CustodyEvent).where(
            CustodyEvent.case_id == tenant.case_id,
            CustodyEvent.action == "evidence_stamp_failed",
        )
    )
    assert event is not None


def test_una_evidencia_ya_sellada_no_vuelve_a_pedir_sello(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    tenant = create_tenant(db, "Sello repetido")
    evidence_id = add_evidence(db, tenant, b"contenido")
    row = db.get(Evidence, evidence_id)
    assert row is not None
    row.tsa_status = "stamped"
    row.tsa_token = b"anterior"
    row.tsa_time = datetime.datetime.now(datetime.UTC)
    db.commit()

    def no_deberia_llamarse(_huella: bytes) -> SelloDeTiempo:
        pytest.fail("No debía pedirse un sello para una evidencia ya resuelta.")

    monkeypatch.setattr(evidence_stamp, "pedir_sello_de_tiempo", no_deberia_llamarse)

    evidence_stamp.stamp(lambda: db, evidence_id, tenant.case_id, tenant.organization_id)

    assert db.get(Evidence, evidence_id).tsa_token == b"anterior"  # type: ignore[union-attr]
