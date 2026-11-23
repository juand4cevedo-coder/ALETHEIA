"""Eliminar un caso cerrado: la solicitud, el borrado de objetos y la constancia (SEQ-004)."""

import datetime
import uuid
from typing import Any

import pytest
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import (
    AuditLog,
    Case,
    CaseMember,
    DeletionRecord,
    Job,
)
from app.services import case_deletion
from app.services.case_deletion_emails import receipt_email
from tests.conftest import NuevoCliente, add_evidence, create_tenant
from tests.organizations import Oficina, crear_miembro, crear_oficina
from tests.test_case_notes import _session

_CASES = "/api/v1/cases"
_TITLE = "Caso a eliminar"


def _closed_case(
    db: Session,
    office: Oficina,
    *,
    status: str = "closed",
    retention_days: int = -1,
    legal_hold: bool = False,
    members: tuple[uuid.UUID, ...] = (),
) -> uuid.UUID:
    """Un caso cerrado, con la conservación vencida (días negativos) o pendiente."""
    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))
    case_id = uuid.uuid7()
    now = datetime.datetime.now(datetime.UTC)
    db.add(
        Case(
            id=case_id,
            organization_id=office.organization_id,
            title=_TITLE,
            status=status,
            closed_at=None if status == "open" else now - datetime.timedelta(days=30),
            retention_until=(
                None if status == "open" else now + datetime.timedelta(days=retention_days)
            ),
            retention_basis=None if status == "open" else "organization_policy",
            legal_hold=legal_hold,
            wrapped_key=b"k" * 40,
            key_version="prueba",
            created_by=office.owner.id,
        )
    )
    db.flush()
    for user_id in (office.owner.id, *members):
        db.add(
            CaseMember(
                case_id=case_id,
                user_id=user_id,
                organization_id=office.organization_id,
                added_by=office.owner.id,
            )
        )
    db.flush()
    return case_id


def _deletion(client: Any, case_id: uuid.UUID, confirmation: str = _TITLE) -> Any:
    return client.post(f"{_CASES}/{case_id}/deletion", json={"confirmation": confirmation})


def _jobs(db: Session, kind: str) -> list[Job]:
    return list(db.scalars(select(Job).where(Job.kind == kind)))


def test_el_dueno_pide_la_eliminacion_y_la_llave_se_destruye_al_instante(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    client = _session(dispositivo, db, office.owner)
    case_id = _closed_case(db, office)

    response = _deletion(client, case_id)

    assert response.status_code == 202, response.text
    assert response.headers["Cache-Control"] == "no-store"
    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))
    db.expire_all()
    case = db.get_one(Case, case_id)
    assert case.status == "deleting"
    assert case.wrapped_key is None
    audit = db.scalars(select(AuditLog).where(AuditLog.action == "case_deletion_requested")).all()
    assert [row.target_id for row in audit] == [case_id]
    purge_jobs = [job for job in _jobs(db, "case_purge") if job.payload["case_id"] == str(case_id)]
    assert len(purge_jobs) == 1
    assert purge_jobs[0].payload["requested_by"] == str(office.owner.id)
    # El caso ya no se muestra y pedirlo otra vez no repite nada.
    assert client.get(f"{_CASES}/{case_id}").status_code == 404
    assert _deletion(client, case_id).status_code == 202
    assert (
        len([job for job in _jobs(db, "case_purge") if job.payload["case_id"] == str(case_id)]) == 1
    )


def test_no_se_elimina_con_otro_texto_un_caso_abierto_ni_con_bloqueo_o_plazo_pendiente(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    client = _session(dispositivo, db, office.owner)
    ready = _closed_case(db, office)
    open_case = _closed_case(db, office, status="open")
    held = _closed_case(db, office, legal_hold=True)
    waiting = _closed_case(db, office, retention_days=400)

    wrong = _deletion(client, ready, "caso a eliminar ")
    not_closed = _deletion(client, open_case)
    on_hold = _deletion(client, held)
    pending = _deletion(client, waiting)

    assert wrong.status_code == 422
    assert not_closed.status_code == 409
    assert "cerrado" in not_closed.json()["detail"]
    assert on_hold.status_code == 409
    assert "bloqueo jurídico" in on_hold.json()["detail"]
    assert pending.status_code == 409
    assert "plazo de conservación" in pending.json()["detail"]
    assert _jobs(db, "case_purge") == []
    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))
    db.expire_all()
    for case_id in (ready, open_case, held, waiting):
        assert db.get_one(Case, case_id).status != "deleting"
        assert db.get_one(Case, case_id).wrapped_key is not None


def test_solo_duenos_y_administradores_eliminan(dispositivo: NuevoCliente, db: Session) -> None:
    office = crear_oficina(db)
    lawyer = crear_miembro(db, office, "abogada.eliminar@example.com", "lawyer")
    admin = crear_miembro(db, office, "admin.eliminar@example.com", "admin")
    stranger = crear_miembro(db, office, "ajena.eliminar@example.com", "admin")
    case_id = _closed_case(db, office, members=(lawyer.id, admin.id))

    by_lawyer = _deletion(_session(dispositivo, db, lawyer), case_id)
    by_stranger = _deletion(_session(dispositivo, db, stranger), case_id)
    by_admin = _deletion(_session(dispositivo, db, admin), case_id)

    assert by_lawyer.status_code == 403
    assert by_stranger.status_code == 404  # no es miembro del caso
    assert by_admin.status_code == 202, by_admin.text


def _mark_deleting(db: Session, tenant_case: uuid.UUID) -> None:
    db.execute(
        update(Case)
        .where(Case.id == tenant_case)
        .values(
            status="deleting",
            closed_at=datetime.datetime.now(datetime.UTC),
            wrapped_key=None,
            retention_until=datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=1),
            retention_basis="organization_policy",
            legal_hold=False,
        )
    )


def test_la_tarea_borra_los_objetos_deja_la_constancia_y_manda_el_correo(
    owner_db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    tenant = create_tenant(owner_db, "Firma")
    first = add_evidence(owner_db, tenant, b"primera conversacion")
    second = add_evidence(owner_db, tenant, b"segunda conversacion")
    _mark_deleting(owner_db, tenant.case_id)
    deleted: list[str] = []
    monkeypatch.setattr(
        case_deletion, "delete_evidence_object", lambda _settings, key: deleted.append(key)
    )
    owner_db.commit()

    case_deletion.purge(
        lambda: owner_db, settings, tenant.case_id, tenant.organization_id, tenant.user_id
    )

    assert sorted(deleted) == sorted([f"evidences/{first}", f"evidences/{second}"])
    record = owner_db.scalar(select(DeletionRecord).where(DeletionRecord.case_id == tenant.case_id))
    assert record is not None
    assert record.evidence_count == 2
    assert owner_db.get(Case, tenant.case_id) is None
    actions = owner_db.scalars(select(AuditLog.action).where(AuditLog.action == "case_deleted"))
    assert list(actions) == ["case_deleted"]
    receipts = [
        job
        for job in _jobs(owner_db, "email_send")
        if job.payload.get("template") == case_deletion.RECEIPT_TEMPLATE
    ]
    assert len(receipts) == 1
    email = receipt_email(owner_db, dict(receipts[0].payload), settings)
    assert email is not None
    assert "2 evidencias" in email.text
    assert "Caso de Firma" not in email.text

    # Repetir la tarea no cambia nada: no hay segunda constancia, auditoría ni correo.
    case_deletion.purge(
        lambda: owner_db, settings, tenant.case_id, tenant.organization_id, tenant.user_id
    )
    assert len(list(owner_db.scalars(select(DeletionRecord)))) == 1
    assert len(_jobs(owner_db, "email_send")) == 1


def test_si_un_objeto_no_se_puede_borrar_el_caso_no_se_elimina(
    owner_db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    tenant = create_tenant(owner_db, "Firma")
    add_evidence(owner_db, tenant, b"una conversacion")
    _mark_deleting(owner_db, tenant.case_id)

    def failing(_settings: Settings, _key: str) -> None:
        raise OSError("sin conexión")

    monkeypatch.setattr(case_deletion, "delete_evidence_object", failing)
    owner_db.commit()

    with pytest.raises(RuntimeError):
        case_deletion.purge(
            lambda: owner_db, settings, tenant.case_id, tenant.organization_id, tenant.user_id
        )

    set_tenant(owner_db, TenantContext(organization_id=tenant.organization_id))
    assert owner_db.get(Case, tenant.case_id) is not None
    assert list(owner_db.scalars(select(DeletionRecord))) == []
