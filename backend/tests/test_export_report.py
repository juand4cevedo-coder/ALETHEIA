"""La declaración de alcance debe verse en el PDF, no solo quedar en el código."""

import datetime
import hashlib
import io
import uuid
from dataclasses import replace

import pytest
from pypdf import PdfReader

from app.services.export_manifest import BuiltManifest, CustodyHead, EvidenceFile, build_manifest
from app.services.export_report import render_report


def _manifest(*, anchor: bool = False) -> BuiltManifest:
    case_id = uuid.UUID("01890a5d-ac96-774b-bcce-b302099a8058")
    evidence_id = uuid.UUID("01890a5d-ac96-774b-bcce-b302099a8060")
    export_id = uuid.UUID("01890a5d-ac96-774b-bcce-b302099a8070")
    return build_manifest(
        export_id,
        case_id,
        datetime.datetime(2026, 11, 17, tzinfo=datetime.UTC),
        [
            EvidenceFile(
                id=evidence_id,
                original_filename="archivo.txt",
                sha256=hashlib.sha256(b"abc").digest(),
                size_bytes=3,
                tsa_status="pending",
                tsa_token_present=False,
            )
        ],
        CustodyHead(seq=2, sha256=b"\xaa" * 32, anchor_token_present=anchor),
    )


def test_pdf_explica_alcance_y_estado_real_sin_anclaje() -> None:
    manifest = _manifest()
    content = render_report(manifest)
    assert content.startswith(b"%PDF-")
    assert content == render_report(manifest)
    reader = PdfReader(io.BytesIO(content))
    assert len(reader.pages) == 1
    text = reader.pages[0].extract_text()
    assert "Informe de preservación" in text
    assert "Sellos pendientes: 1" in text
    assert "Anclaje externo de la cabeza: no disponible" in text
    assert manifest.sha256.hex() in text
    assert "no autentica el archivo ni el manifiesto" in text
    assert "ni determina admisibilidad o valor probatorio" in text
    assert "Sin anclaje externo" in text


def test_pdf_indica_anclaje_solo_cuando_el_manifiesto_lo_contiene() -> None:
    text = PdfReader(io.BytesIO(render_report(_manifest(anchor=True)))).pages[0].extract_text()
    assert "Anclaje externo de la cabeza: incluido" in text
    assert "Sin anclaje externo" not in text


def test_pdf_rechaza_manifiesto_con_huella_incorrecta() -> None:
    with pytest.raises(ValueError, match="huella"):
        render_report(replace(_manifest(), sha256=bytes(32)))
