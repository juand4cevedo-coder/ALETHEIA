"""Sello de tiempo: descargarlo para verificarlo fuera de ALETHEIA y pedirlo otra vez si falló."""

import datetime
import hashlib
import uuid

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Case, CaseMember, Evidence, Job
from app.services.evidence_timestamp import timestamp_authority
from tests.conftest import NuevoCliente
from tests.organizations import Oficina, crear_oficina
from tests.test_case_notes import _session

_CASES = "/api/v1/cases"
_CONTENT = b"contenido de la evidencia"


def _case_with_evidence(
    db: Session, office: Oficina, *, tsa_status: str = "failed"
) -> tuple[uuid.UUID, uuid.UUID]:
    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))
    case_id, evidence_id = uuid.uuid7(), uuid.uuid7()
    db.add(
        Case(
            id=case_id,
            organization_id=office.organization_id,
            title="Caso con sello",
            wrapped_key=b"k" * 40,
            key_version="prueba",
            created_by=office.owner.id,
        )
    )
    db.flush()
    db.add(
        CaseMember(
            case_id=case_id,
            user_id=office.owner.id,
            organization_id=office.organization_id,
            added_by=office.owner.id,
        )
    )
    db.add(
        Evidence(
            id=evidence_id,
            organization_id=office.organization_id,
            case_id=case_id,
            sha256=hashlib.sha256(_CONTENT).digest(),
            size_bytes=len(_CONTENT),
            original_filename="informe.pdf",
            declared_type="document",
            detected_type="application/pdf",
            declared_origin="Entregado por el cliente",
            storage_key=f"evidences/{evidence_id}",
            uploaded_by=office.owner.id,
            tsa_status=tsa_status,
        )
    )
    db.flush()
    return case_id, evidence_id


def test_un_sello_fallido_se_pide_otra_vez_y_queda_en_la_auditoria(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    client = _session(dispositivo, db, office.owner)
    case_id, evidence_id = _case_with_evidence(db, office)

    response = client.post(f"{_CASES}/{case_id}/evidences/{evidence_id}/timestamp/retry")

    assert response.status_code == 202, response.text
    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))
    db.expire_all()
    assert db.get_one(Evidence, evidence_id).tsa_status == "pending"
    jobs = [
        job
        for job in db.scalars(select(Job).where(Job.kind == "tsa_stamp"))
        if job.payload["evidence_id"] == str(evidence_id)
    ]
    assert len(jobs) == 1
    audit = db.scalars(select(AuditLog).where(AuditLog.action == "evidence_stamp_retried")).all()
    assert [row.target_id for row in audit] == [evidence_id]
    # Ya no está fallido: pedirlo de nuevo no se acepta.
    again = client.post(f"{_CASES}/{case_id}/evidences/{evidence_id}/timestamp/retry")
    assert again.status_code == 409


def test_solo_se_descarga_un_sello_ya_obtenido(dispositivo: NuevoCliente, db: Session) -> None:
    office = crear_oficina(db)
    client = _session(dispositivo, db, office.owner)
    case_id, evidence_id = _case_with_evidence(db, office, tsa_status="pending")
    url = f"{_CASES}/{case_id}/evidences/{evidence_id}/timestamp"

    assert client.get(url).status_code == 404

    db.execute(
        update(Evidence)
        .where(Evidence.id == evidence_id)
        .values(
            tsa_status="stamped",
            tsa_token=b"respuesta-rfc3161",
            tsa_time=datetime.datetime.now(datetime.UTC),
        )
    )
    db.flush()
    response = client.get(url)

    assert response.status_code == 200, response.text
    assert response.content == b"respuesta-rfc3161"
    assert response.headers["Content-Type"] == "application/timestamp-reply"
    assert "informe.pdf.tsr" in response.headers["Content-Disposition"]
    assert response.headers["X-Content-SHA256"] == hashlib.sha256(_CONTENT).hexdigest()
    detail = client.get(f"{_CASES}/{case_id}/evidences/{evidence_id}").json()
    assert detail["tsa_status"] == "stamped"
    assert detail["tsa_authority"] is None  # un token que no es RFC 3161 no se interpreta


def test_la_autoridad_no_se_inventa_si_el_sello_no_se_puede_leer() -> None:
    assert timestamp_authority(None) is None
    assert timestamp_authority(b"") is None
    assert timestamp_authority(b"no es un sello") is None


def test_la_cadena_muestra_la_huella_anterior_y_solo_datos_permitidos(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    client = _session(dispositivo, db, office.owner)
    created = client.post(_CASES, json={"title": "Caso con cadena"}).json()["id"]

    page = client.get(f"{_CASES}/{created}/custody-events").json()

    event = page["items"][0]
    assert event["seq"] == 1
    assert len(event["event_hash"]) == 64
    assert len(event["prev_hash"]) == 64
    assert event["evidence_id"] is None
    assert isinstance(event["details"], dict)
    assert set(event["details"]) <= {
        "sha256",
        "size_bytes",
        "tsa_time",
        "reason",
        "export_id",
        "manifest_sha256",
        "link_id",
        "expires_at",
        "retention_until",
        "retention_basis",
        "name",
        "role",
    }
