"""El ZIP incluye los bytes declarados y rechaza contenidos o cadenas alteradas."""

import datetime
import hashlib
import io
import json
import uuid
import zipfile
from dataclasses import replace

import pytest
from pypdf import PdfReader

from app.services.custody_chain import GENESIS_HASH, ChainEvent, event_digest
from app.services.export_manifest import EvidenceFile
from app.services.export_package import PackageEvidence, PackageIntegrityError, build_package

CASE_ID = uuid.UUID("01890a5d-ac96-774b-bcce-b302099a8058")
EXPORT_ID = uuid.UUID("01890a5d-ac96-774b-bcce-b302099a8070")
FILE_ID = uuid.UUID("01890a5d-ac96-774b-bcce-b302099a8060")
DATE = datetime.datetime(2026, 11, 17, tzinfo=datetime.UTC)


def _event() -> ChainEvent:
    event = ChainEvent(
        case_id=CASE_ID,
        seq=1,
        evidence_id=None,
        actor_user_id=None,
        action="case_created",
        details_text='{"filing_number": "ALE-001"}',
        occurred_at=DATE,
        prev_hash=GENESIS_HASH,
        event_hash=GENESIS_HASH,
    )
    return replace(event, event_hash=event_digest(event))


def _file(
    content: bytes = b"abc", *, stamped: bool = False, evidence_id: uuid.UUID = FILE_ID
) -> PackageEvidence:
    return PackageEvidence(
        metadata=EvidenceFile(
            id=evidence_id,
            original_filename="../archivo.txt",
            sha256=hashlib.sha256(b"abc").digest(),
            size_bytes=3,
            tsa_status="stamped" if stamped else "pending",
            tsa_token_present=stamped,
        ),
        chunks=(content[index : index + 1] for index in range(len(content))),
        tsa_token=b"token" if stamped else None,
    )


def test_zip_contiene_original_manifiesto_custodia_informe_y_sello_si_existe() -> None:
    target = io.BytesIO()
    manifest = build_package(
        target,
        export_id=EXPORT_ID,
        case_id=CASE_ID,
        generated_at=DATE,
        evidences=[_file(stamped=True)],
        custody_events=[_event()],
        report_pdf=b"%PDF-1.7\n%%EOF",
        anchor_token=b"anchor",
    )

    with zipfile.ZipFile(io.BytesIO(target.getvalue())) as archive:
        assert set(archive.namelist()) == {
            f"files/{FILE_ID}",
            f"timestamps/{FILE_ID}.tsr",
            "custody/events.json",
            "custody/head.tsr",
            "report.pdf",
            "manifest.json",
        }
        assert archive.read(f"files/{FILE_ID}") == b"abc"
        assert hashlib.sha256(archive.read("manifest.json")).digest() == manifest.sha256
        data = json.loads(archive.read("manifest.json"))
        assert data["evidences"][0]["path"] == f"files/{FILE_ID}"
        assert data["evidences"][0]["original_filename"] == "../archivo.txt"
        assert data["custody"]["head_sha256"] == _event().event_hash.hex()
        assert data["custody"]["anchor_token_path"] == "custody/head.tsr"  # noqa: S105
        events = json.loads(archive.read("custody/events.json"))
        assert events["events"][0]["details_jsonb_text"] == _event().details_text


def test_sello_pendiente_no_inventa_token() -> None:
    target = io.BytesIO()
    build_package(
        target,
        export_id=EXPORT_ID,
        case_id=CASE_ID,
        generated_at=DATE,
        evidences=[_file()],
        custody_events=[_event()],
        report_pdf=b"%PDF-1.7\n%%EOF",
    )
    with zipfile.ZipFile(io.BytesIO(target.getvalue())) as archive:
        assert not any(name.endswith(".tsr") for name in archive.namelist())
        data = json.loads(archive.read("manifest.json"))
        assert data["evidences"][0]["tsa_status"] == "pending"
        assert data["evidences"][0]["tsa_token_path"] is None
        assert data["custody"]["anchor_token_path"] is None


def test_paquete_genera_informe_pdf_si_no_se_proporciona() -> None:
    target = io.BytesIO()
    build_package(
        target,
        export_id=EXPORT_ID,
        case_id=CASE_ID,
        generated_at=DATE,
        evidences=[_file()],
        custody_events=[_event()],
    )
    with zipfile.ZipFile(io.BytesIO(target.getvalue())) as archive:
        report = PdfReader(io.BytesIO(archive.read("report.pdf")))
        assert "Sellos pendientes: 1" in report.pages[0].extract_text()


def test_nombres_originales_iguales_no_colisionan() -> None:
    other_id = uuid.UUID("01890a5d-ac96-774b-bcce-b302099a8061")
    target = io.BytesIO()
    build_package(
        target,
        export_id=EXPORT_ID,
        case_id=CASE_ID,
        generated_at=DATE,
        evidences=[_file(evidence_id=other_id), _file()],
        custody_events=[_event()],
        report_pdf=b"%PDF-1.7\n%%EOF",
    )
    with zipfile.ZipFile(io.BytesIO(target.getvalue())) as archive:
        assert archive.read(f"files/{FILE_ID}") == b"abc"
        assert archive.read(f"files/{other_id}") == b"abc"
        data = json.loads(archive.read("manifest.json"))
        assert [row["id"] for row in data["evidences"]] == [str(FILE_ID), str(other_id)]


def test_original_alterado_y_cadena_rota_rechazan_paquete() -> None:
    with pytest.raises(PackageIntegrityError, match="original"):
        build_package(
            io.BytesIO(),
            export_id=EXPORT_ID,
            case_id=CASE_ID,
            generated_at=DATE,
            evidences=[_file(b"abd")],
            custody_events=[_event()],
            report_pdf=b"%PDF-1.7\n%%EOF",
        )
    with pytest.raises(PackageIntegrityError, match="cadena"):
        build_package(
            io.BytesIO(),
            export_id=EXPORT_ID,
            case_id=CASE_ID,
            generated_at=DATE,
            evidences=[_file()],
            custody_events=[replace(_event(), event_hash=bytes(32))],
            report_pdf=b"%PDF-1.7\n%%EOF",
        )


def test_no_acepta_tokens_vacios_ni_informe_que_no_sea_pdf() -> None:
    with pytest.raises(ValueError, match="anclaje"):
        build_package(
            io.BytesIO(),
            export_id=EXPORT_ID,
            case_id=CASE_ID,
            generated_at=DATE,
            evidences=[_file()],
            custody_events=[_event()],
            report_pdf=b"%PDF-1.7\n%%EOF",
            anchor_token=b"",
        )
    with pytest.raises(ValueError, match="PDF"):
        build_package(
            io.BytesIO(),
            export_id=EXPORT_ID,
            case_id=CASE_ID,
            generated_at=DATE,
            evidences=[_file()],
            custody_events=[_event()],
            report_pdf=b"documento",
        )
