"""Construcción reintentable del paquete fuera de transacciones de base de datos."""

import datetime
import time
import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from typing import BinaryIO, cast

from sqlalchemy import select
from sqlalchemy.orm import Session
from tink import streaming_aead

from app.adapters.export_storage import export_storage_key, new_export_sink
from app.adapters.keys import KeyWrapper, WrappedKey
from app.core.case_keys import open_case_key
from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import Case, CustodyEvent, Evidence, Export
from app.services import jobs
from app.services.custody_chain import ChainEvent, load
from app.services.evidence_download import PreparedDownload
from app.services.evidence_upload import ASSOCIATED_PREFIX
from app.services.export_manifest import EvidenceFile
from app.services.export_package import PackageEvidence, build_package
from app.services.jobs import PermanentJobError


@dataclass(frozen=True, slots=True)
class EvidenceSnapshot:
    id: uuid.UUID
    filename: str
    sha256: bytes
    size_bytes: int
    storage_key: str
    tsa_status: str
    tsa_token: bytes | None


@dataclass(frozen=True, slots=True)
class ExportSnapshot:
    export_id: uuid.UUID
    case_id: uuid.UUID
    organization_id: uuid.UUID
    wrapped_key: bytes
    key_version: str
    evidences: list[EvidenceSnapshot]
    events: list[ChainEvent]


def _snapshot(
    session: Session, export_id: uuid.UUID, organization_id: uuid.UUID
) -> ExportSnapshot | None:
    set_tenant(session, TenantContext(organization_id=organization_id))
    export = session.scalar(
        select(Export).where(Export.id == export_id, Export.organization_id == organization_id)
    )
    if export is None:
        raise PermanentJobError("La exportación ya no existe.")
    if export.status == "ready":
        return None
    if export.status not in {"queued", "building", "failed"}:
        raise PermanentJobError("La exportación no admite construcción.")
    case = session.scalar(
        select(Case).where(Case.id == export.case_id, Case.organization_id == organization_id)
    )
    if case is None or case.wrapped_key is None or case.status == "deleting":
        raise PermanentJobError("El caso no permite construir el paquete.")
    export.status = "building"
    evidences = session.scalars(
        select(Evidence)
        .where(Evidence.case_id == case.id, Evidence.organization_id == organization_id)
        .order_by(Evidence.id)
    ).all()
    events = load(session, case.id)
    return ExportSnapshot(
        export_id=export.id,
        case_id=case.id,
        organization_id=organization_id,
        wrapped_key=case.wrapped_key,
        key_version=case.key_version,
        evidences=[
            EvidenceSnapshot(
                id=row.id,
                filename=row.original_filename,
                sha256=row.sha256,
                size_bytes=row.size_bytes,
                storage_key=row.storage_key,
                tsa_status=row.tsa_status,
                tsa_token=row.tsa_token,
            )
            for row in evidences
        ],
        events=events,
    )


def _files(
    snapshot: ExportSnapshot,
    cipher: streaming_aead.StreamingAead,
    settings: Settings,
    renew_lease: Callable[[], None],
) -> Iterator[PackageEvidence]:
    for row in snapshot.evidences:
        download = PreparedDownload(
            filename=row.filename,
            size_bytes=row.size_bytes,
            sha256=row.sha256,
            storage_key=row.storage_key,
            associated_data=ASSOCIATED_PREFIX + snapshot.case_id.bytes + row.id.bytes,
            cipher=cipher,
            settings=settings,
        )

        def chunks(download: PreparedDownload = download) -> Iterator[bytes]:
            for chunk in download.chunks():
                renew_lease()
                yield chunk

        yield PackageEvidence(
            EvidenceFile(
                id=row.id,
                original_filename=row.filename,
                sha256=row.sha256,
                size_bytes=row.size_bytes,
                tsa_status=row.tsa_status,
                tsa_token_present=row.tsa_token is not None,
            ),
            chunks(),
            tsa_token=row.tsa_token,
        )


def _publish(
    session: Session, snapshot: ExportSnapshot, manifest_hash: bytes, now: datetime.datetime
) -> None:
    set_tenant(session, TenantContext(organization_id=snapshot.organization_id))
    export = session.scalar(
        select(Export)
        .where(Export.id == snapshot.export_id, Export.organization_id == snapshot.organization_id)
        .with_for_update()
    )
    if export is None or export.status != "building":
        raise PermanentJobError("La exportación cambió durante su construcción.")
    case = session.scalar(
        select(Case)
        .where(Case.id == snapshot.case_id, Case.organization_id == snapshot.organization_id)
        .with_for_update()
    )
    if case is None or case.status == "deleting":
        raise PermanentJobError("El caso cambió durante la construcción.")
    previous = session.scalar(
        select(CustodyEvent.event_hash).where(
            CustodyEvent.case_id == case.id, CustodyEvent.seq == case.custody_seq
        )
    )
    if previous is None:
        raise PermanentJobError("La cadena de custodia no tiene cabeza.")
    export.manifest_sha256 = manifest_hash
    export.storage_key = export_storage_key(export.id)
    export.expires_at = now + datetime.timedelta(hours=24)
    export.status = "ready"
    session.add(
        CustodyEvent(
            organization_id=snapshot.organization_id,
            case_id=case.id,
            seq=case.custody_seq + 1,
            actor_user_id=export.requested_by,
            action="export_ready",
            details={"export_id": str(export.id), "manifest_sha256": manifest_hash.hex()},
            occurred_at=now,
            prev_hash=previous,
        )
    )
    jobs.enqueue(
        session,
        "export_expire",
        {"export_id": str(export.id), "organization_id": str(snapshot.organization_id)},
        f"export_expire:{export.id}",
        delay=datetime.timedelta(hours=24),
    )
    session.flush()


def _mark_failed(
    open_session: Callable[[], Session], export_id: uuid.UUID, org_id: uuid.UUID
) -> None:
    with open_session() as session, session.begin():
        set_tenant(session, TenantContext(organization_id=org_id))
        export = session.scalar(
            select(Export)
            .where(Export.id == export_id, Export.organization_id == org_id)
            .with_for_update()
        )
        if export is not None and export.status == "building":
            export.status = "failed"


def build(
    open_session: Callable[[], Session],
    settings: Settings,
    wrapper: KeyWrapper,
    export_id: uuid.UUID,
    organization_id: uuid.UUID,
    renew_lease: Callable[[], None],
) -> None:
    """Una tarea repetida deja intacto un paquete listo; los demás intentos reconstruyen."""
    with open_session() as session, session.begin():
        snapshot = _snapshot(session, export_id, organization_id)
    if snapshot is None:
        return
    sink = None
    last_renewed = 0.0

    def maybe_renew(*, force: bool = False) -> None:
        nonlocal last_renewed
        now = time.monotonic()
        if force or now - last_renewed >= 60:
            renew_lease()
            last_renewed = now

    try:
        maybe_renew(force=True)
        cipher = open_case_key(wrapper, WrappedKey(snapshot.wrapped_key, snapshot.key_version))
        primitive = cipher.primitive(streaming_aead.StreamingAead)
        sink = new_export_sink(settings, export_id)
        manifest = build_package(
            cast(BinaryIO, sink),
            export_id=export_id,
            case_id=snapshot.case_id,
            generated_at=datetime.datetime.now(datetime.UTC),
            evidences=_files(snapshot, primitive, settings, maybe_renew),
            custody_events=snapshot.events,
        )
        maybe_renew(force=True)
        sink.commit()
        with open_session() as session, session.begin():
            _publish(session, snapshot, manifest.sha256, datetime.datetime.now(datetime.UTC))
    except Exception:
        if sink is not None:
            sink.abort()
        _mark_failed(open_session, export_id, organization_id)
        raise
