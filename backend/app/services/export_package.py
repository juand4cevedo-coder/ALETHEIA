"""Construye el contenido del ZIP de preservación sin depender de S3 ni de la cola."""

import datetime
import hashlib
import hmac
import json
import uuid
import zipfile
from collections.abc import Iterable
from dataclasses import dataclass
from typing import BinaryIO

from app.services.custody_chain import ChainEvent, verify
from app.services.export_manifest import (
    BuiltManifest,
    CustodyHead,
    EvidenceFile,
    build_manifest,
)


class PackageIntegrityError(Exception):
    """Un original o la cadena de custodia no coincide con sus huellas guardadas."""


@dataclass(frozen=True, slots=True)
class PackageEvidence:
    metadata: EvidenceFile
    chunks: Iterable[bytes]
    tsa_token: bytes | None = None


def _entry(name: str) -> zipfile.ZipInfo:
    # Sin rutas aportadas por el usuario ni fecha variable en los encabezados del ZIP.
    info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_STORED
    return info


def _timestamp(value: datetime.datetime) -> str:
    return value.astimezone(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _custody_content(case_id: uuid.UUID, events: list[ChainEvent]) -> bytes:
    rows = [
        {
            "action": event.action,
            "actor_user_id": str(event.actor_user_id) if event.actor_user_id else None,
            "details_jsonb_text": event.details_text,
            "event_hash": event.event_hash.hex(),
            "evidence_id": str(event.evidence_id) if event.evidence_id else None,
            "occurred_at": _timestamp(event.occurred_at),
            "prev_hash": event.prev_hash.hex(),
            "seq": event.seq,
        }
        for event in events
    ]
    document = {
        "case_id": str(case_id),
        "events": rows,
        "format": "aletheia-custody-events",
        "format_version": 1,
    }
    return (
        json.dumps(document, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
    ).encode("utf-8")


def build_package(
    target: BinaryIO,
    *,
    export_id: uuid.UUID,
    case_id: uuid.UUID,
    generated_at: datetime.datetime,
    evidences: Iterable[PackageEvidence],
    custody_events: Iterable[ChainEvent],
    report_pdf: bytes,
    anchor_token: bytes | None = None,
) -> BuiltManifest:
    """Escribe el ZIP por flujo y devuelve la huella de `manifest.json`.

    `target` debe ser descartable/abortable: ante cualquier fallo no se publica el ZIP parcial.
    La carga y el descifrado de originales ocurren fuera de una transacción de base de datos.
    """
    if not report_pdf.startswith(b"%PDF-"):
        raise ValueError("El informe debe ser un PDF.")
    if anchor_token == b"":
        raise ValueError("El token de anclaje no puede estar vacío.")
    files = sorted(evidences, key=lambda entry: entry.metadata.id.int)
    events = list(custody_events)
    if any(event.case_id != case_id for event in events):
        raise PackageIntegrityError("La cadena contiene un evento de otro caso.")
    report = verify(events)
    if not report.intact or report.events_checked < 1:
        raise PackageIntegrityError("La cadena de custodia no está íntegra.")
    for entry in files:
        if entry.tsa_token == b"":
            raise ValueError("El token de sello no puede estar vacío.")
        if (entry.tsa_token is not None) != entry.metadata.tsa_token_present:
            raise ValueError("El token de sello no coincide con el estado de la evidencia.")
    manifest = build_manifest(
        export_id,
        case_id,
        generated_at,
        [entry.metadata for entry in files],
        CustodyHead(report.events_checked, report.head_hash, anchor_token is not None),
    )

    with zipfile.ZipFile(target, mode="w", allowZip64=True) as archive:
        for entry in files:
            with archive.open(
                _entry(f"files/{entry.metadata.id}"), mode="w", force_zip64=True
            ) as dest:
                digest = hashlib.sha256()
                size = 0
                for chunk in entry.chunks:
                    digest.update(chunk)
                    size += len(chunk)
                    dest.write(chunk)
            if size != entry.metadata.size_bytes or not hmac.compare_digest(
                digest.digest(), entry.metadata.sha256
            ):
                raise PackageIntegrityError("Un original no coincide con su huella o tamaño.")
            if entry.tsa_token is not None:
                archive.writestr(_entry(f"timestamps/{entry.metadata.id}.tsr"), entry.tsa_token)
        archive.writestr(_entry("custody/events.json"), _custody_content(case_id, events))
        if anchor_token is not None:
            archive.writestr(_entry("custody/head.tsr"), anchor_token)
        archive.writestr(_entry("report.pdf"), report_pdf)
        archive.writestr(_entry("manifest.json"), manifest.content)
    return manifest
