"""Manifiesto versionado del paquete de preservación (ADR-044)."""

import datetime
import hashlib
import json
import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Final

FORMAT: Final = "aletheia-preservation-manifest"
FORMAT_VERSION: Final = 1
SCOPE: Final = "file-integrity"
TSA_STATUSES: Final = frozenset(("pending", "stamped", "failed"))


@dataclass(frozen=True, slots=True)
class EvidenceFile:
    id: uuid.UUID
    original_filename: str
    sha256: bytes
    size_bytes: int
    tsa_status: str
    tsa_token_present: bool


@dataclass(frozen=True, slots=True)
class CustodyHead:
    seq: int
    sha256: bytes
    anchor_token_present: bool


@dataclass(frozen=True, slots=True)
class BuiltManifest:
    content: bytes
    sha256: bytes


def _sha256(value: bytes) -> str:
    if len(value) != 32:
        raise ValueError("La huella SHA-256 debe tener 32 bytes.")
    return value.hex()


def _evidence(entry: EvidenceFile) -> dict[str, object]:
    if not 1 <= len(entry.original_filename) <= 255:
        raise ValueError("El nombre original debe tener entre 1 y 255 caracteres.")
    if entry.size_bytes <= 0:
        raise ValueError("El tamaño de una evidencia debe ser positivo.")
    if entry.tsa_status not in TSA_STATUSES:
        raise ValueError("Estado de sello desconocido.")
    if (entry.tsa_status == "stamped") != entry.tsa_token_present:
        raise ValueError("Un sello marcado como completado debe tener token, y viceversa.")
    return {
        "id": str(entry.id),
        "original_filename": entry.original_filename,
        "path": f"files/{entry.id}",
        "sha256": _sha256(entry.sha256),
        "size_bytes": entry.size_bytes,
        "tsa_status": entry.tsa_status,
        "tsa_token_path": f"timestamps/{entry.id}.tsr" if entry.tsa_token_present else None,
    }


def build_manifest(
    export_id: uuid.UUID,
    case_id: uuid.UUID,
    generated_at: datetime.datetime,
    evidences: Iterable[EvidenceFile],
    custody: CustodyHead,
) -> BuiltManifest:
    """Serializa los bytes exactos que se guardan en el ZIP y cuya huella va en exports."""
    if generated_at.tzinfo is None or generated_at.utcoffset() is None:
        raise ValueError("La fecha de generación debe tener zona horaria.")
    if custody.seq < 1:
        raise ValueError("La cadena de custodia debe tener al menos un evento.")
    ordered = sorted(evidences, key=lambda row: row.id.int)
    if len({row.id for row in ordered}) != len(ordered):
        raise ValueError("Una evidencia aparece más de una vez en el manifiesto.")
    document = {
        "case_id": str(case_id),
        "custody": {
            "anchor_token_path": "custody/head.tsr" if custody.anchor_token_present else None,
            "events_path": "custody/events.json",
            "head_seq": custody.seq,
            "head_sha256": _sha256(custody.sha256),
        },
        "evidences": [_evidence(row) for row in ordered],
        "export_id": str(export_id),
        "format": FORMAT,
        "format_version": FORMAT_VERSION,
        "generated_at": generated_at.astimezone(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "scope": SCOPE,
    }
    content = (
        json.dumps(document, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
    ).encode("utf-8")
    return BuiltManifest(content=content, sha256=hashlib.sha256(content).digest())
