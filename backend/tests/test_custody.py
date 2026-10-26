"""Pruebas de la cadena de custodia de solo inserción y de purge_case (ADR-004)."""

import datetime
import hashlib
import uuid

from psycopg.errors import (
    CheckViolation,
    InsufficientPrivilege,
    ObjectNotInPrerequisiteState,
    RestrictViolation,
)
from sqlalchemy import func, select, text, update
from sqlalchemy.orm import Session

from app.models import Case, CustodyEvent, DeletionRecord, Evidence, Organization
from tests.conftest import ZERO_HASH, Tenant, add_evidence, create_tenant, rejected


def _event(tenant: Tenant, seq: int, prev_hash: bytes) -> CustodyEvent:
    # El hash real lo calcula la aplicación sobre una serialización canónica (Sprint 4);
    # aquí basta un valor distinto por evento.
    return CustodyEvent(
        organization_id=tenant.organization_id,
        case_id=tenant.case_id,
        seq=seq,
        actor_user_id=tenant.user_id,
        action="case_created" if seq == 1 else "chain_verified",
        details={},
        occurred_at=datetime.datetime.now(datetime.UTC),
        prev_hash=prev_hash,
        event_hash=hashlib.sha256(f"{tenant.case_id}:{seq}".encode()).digest(),
    )


def _chain(db: Session, tenant: Tenant, length: int) -> bytes:
    """Agrega una cadena válida de eventos y devuelve el hash del último."""
    prev_hash = ZERO_HASH
    for seq in range(1, length + 1):
        event = _event(tenant, seq, prev_hash)
        db.add(event)
        db.flush()
        prev_hash = event.event_hash
    return prev_hash


def _mark_for_deletion(db: Session, tenant: Tenant) -> None:
    db.execute(
        update(Case)
        .where(Case.id == tenant.case_id)
        .values(status="deleting", closed_at=func.now(), wrapped_key=None)
    )


def _purge(db: Session, tenant: Tenant, record_id: uuid.UUID) -> uuid.UUID | None:
    result: uuid.UUID | None = db.scalar(
        text("SELECT purge_case(:case_id, :record_id, :user_id, '7 days')"),
        {"case_id": tenant.case_id, "record_id": record_id, "user_id": tenant.user_id},
    )
    return result


def test_la_cadena_acepta_eventos_encadenados(db: Session) -> None:
    tenant = create_tenant(db, "Firma")

    _chain(db, tenant, 3)

    assert db.scalar(select(Case.custody_seq).where(Case.id == tenant.case_id)) == 3


def test_la_cadena_rechaza_un_salto_de_numero(db: Session) -> None:
    tenant = create_tenant(db, "Firma")
    last_hash = _chain(db, tenant, 2)

    with rejected(db, CheckViolation):
        db.add(_event(tenant, 4, last_hash))


def test_la_cadena_rechaza_un_hash_previo_que_no_coincide(db: Session) -> None:
    tenant = create_tenant(db, "Firma")
    _chain(db, tenant, 2)

    with rejected(db, CheckViolation):
        db.add(_event(tenant, 3, hashlib.sha256(b"otro").digest()))


def test_la_aplicacion_no_edita_ni_borra_eventos(db: Session) -> None:
    tenant = create_tenant(db, "Firma")
    _chain(db, tenant, 1)

    with rejected(db, InsufficientPrivilege):
        db.execute(text("UPDATE custody_events SET details = '{\"editado\": true}'"))
    with rejected(db, InsufficientPrivilege):
        db.execute(text("DELETE FROM custody_events"))


def test_ni_el_dueno_del_esquema_edita_borra_o_vacia_la_cadena(owner_db: Session) -> None:
    tenant = create_tenant(owner_db, "Firma")
    _chain(owner_db, tenant, 1)

    for statement in (
        "UPDATE custody_events SET details = '{\"editado\": true}'",
        "DELETE FROM custody_events",
        "TRUNCATE custody_events",
    ):
        with rejected(owner_db, RestrictViolation):
            owner_db.execute(text(statement))


def test_purge_case_exige_un_caso_marcado_para_eliminar(db: Session) -> None:
    tenant = create_tenant(db, "Firma")

    with rejected(db, ObjectNotInPrerequisiteState):
        _purge(db, tenant, uuid.uuid7())


def test_purge_case_deja_constancia_y_borra_el_caso(db: Session) -> None:
    tenant = create_tenant(db, "Firma")
    add_evidence(db, tenant, b"primera conversacion")
    add_evidence(db, tenant, b"segunda conversacion")
    _chain(db, tenant, 2)
    db.execute(
        update(Organization)
        .where(Organization.id == tenant.organization_id)
        .values(storage_used_bytes=40)
    )
    _mark_for_deletion(db, tenant)
    record_id = uuid.uuid7()

    assert _purge(db, tenant, record_id) == record_id

    record = db.get_one(DeletionRecord, record_id)
    assert record.case_id == tenant.case_id
    assert record.evidence_count == 2
    assert record.total_bytes == 40
    assert sorted(record.evidence_hashes) == sorted(
        hashlib.sha256(content).hexdigest()
        for content in (b"primera conversacion", b"segunda conversacion")
    )
    assert record.backups_expire_at - record.key_destroyed_at == datetime.timedelta(days=7)
    assert db.get(Case, tenant.case_id) is None
    for model in (Evidence, CustodyEvent):
        assert db.scalar(select(func.count()).select_from(model)) == 0
    storage = db.scalar(
        select(Organization.storage_used_bytes).where(Organization.id == tenant.organization_id)
    )
    assert storage == 0


def test_purge_case_repetido_devuelve_la_misma_constancia(db: Session) -> None:
    tenant = create_tenant(db, "Firma")
    _mark_for_deletion(db, tenant)
    first = _purge(db, tenant, uuid.uuid7())

    assert _purge(db, tenant, uuid.uuid7()) == first
    assert db.scalar(select(func.count()).select_from(DeletionRecord)) == 1


def test_la_constancia_de_eliminacion_no_se_modifica(db: Session, owner_db: Session) -> None:
    tenant = create_tenant(db, "Firma")
    _mark_for_deletion(db, tenant)
    _purge(db, tenant, uuid.uuid7())

    with rejected(db, InsufficientPrivilege):
        db.execute(text("UPDATE deletion_records SET evidence_count = 0"))

    owner_tenant = create_tenant(owner_db, "Otra firma")
    _mark_for_deletion(owner_db, owner_tenant)
    _purge(owner_db, owner_tenant, uuid.uuid7())
    with rejected(owner_db, RestrictViolation):
        owner_db.execute(text("DELETE FROM deletion_records"))
