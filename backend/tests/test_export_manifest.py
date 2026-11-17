"""Contrato de bytes que compartirán el exportador y el verificador público."""

import datetime
import hashlib
import json
import uuid
from dataclasses import replace

import pytest

from app.services.export_manifest import CustodyHead, EvidenceFile, build_manifest

EXPORT_ID = uuid.UUID("01890a5d-ac96-774b-bcce-b302099a8070")
CASE_ID = uuid.UUID("01890a5d-ac96-774b-bcce-b302099a8058")
EARLIER_ID = uuid.UUID("01890a5d-ac96-774b-bcce-b302099a8060")
LATER_ID = uuid.UUID("01890a5d-ac96-774b-bcce-b302099a8061")
DATE = datetime.datetime(
    2026, 11, 16, 13, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=-5))
)
HEAD = CustodyHead(seq=2, sha256=b"\xaa" * 32, anchor_token_present=False)


def _file(evidence_id: uuid.UUID, *, status: str = "pending", token: bool = False) -> EvidenceFile:
    return EvidenceFile(
        id=evidence_id,
        original_filename="../conversación.txt",
        sha256=b"\xbb" * 32,
        size_bytes=12,
        tsa_status=status,
        tsa_token_present=token,
    )


def test_manifiesto_estable_y_rutas_independientes_del_nombre() -> None:
    first = build_manifest(EXPORT_ID, CASE_ID, DATE, [_file(LATER_ID), _file(EARLIER_ID)], HEAD)
    second = build_manifest(EXPORT_ID, CASE_ID, DATE, [_file(EARLIER_ID), _file(LATER_ID)], HEAD)
    assert first == second
    assert first.sha256 == hashlib.sha256(first.content).digest()
    assert first.content.endswith(b"\n")
    assert not first.content.endswith(b"\n\n")

    data = json.loads(first.content)
    assert data["format"] == "aletheia-preservation-manifest"
    assert data["format_version"] == 1
    assert data["generated_at"] == "2026-11-16T18:00:00.000000Z"
    assert [item["id"] for item in data["evidences"]] == [str(EARLIER_ID), str(LATER_ID)]
    assert data["evidences"][0]["path"] == f"files/{EARLIER_ID}"
    assert data["evidences"][0]["original_filename"] == "../conversación.txt"
    assert data["evidences"][0]["tsa_token_path"] is None
    assert data["custody"]["anchor_token_path"] is None
    assert b"conversaci\xc3\xb3n" in first.content


def test_sello_y_anclaje_tienen_rutas_fijas_solo_si_existen() -> None:
    manifest = build_manifest(
        EXPORT_ID,
        CASE_ID,
        DATE,
        [_file(EARLIER_ID, status="stamped", token=True)],
        replace(HEAD, anchor_token_present=True),
    )
    data = json.loads(manifest.content)
    assert data["evidences"][0]["tsa_token_path"] == f"timestamps/{EARLIER_ID}.tsr"
    assert data["custody"]["anchor_token_path"] == "custody/head.tsr"  # noqa: S105


@pytest.mark.parametrize(
    "bad_file",
    [
        _file(EARLIER_ID, status="stamped", token=False),
        _file(EARLIER_ID, status="pending", token=True),
        replace(_file(EARLIER_ID), sha256=b"corta"),
        replace(_file(EARLIER_ID), size_bytes=0),
    ],
)
def test_rechaza_metadatos_que_producirian_un_paquete_incoherente(bad_file: EvidenceFile) -> None:
    with pytest.raises(ValueError, match=r"sello|huella|tamaño"):
        build_manifest(EXPORT_ID, CASE_ID, DATE, [bad_file], HEAD)


def test_rechaza_duplicados_y_fecha_sin_zona() -> None:
    with pytest.raises(ValueError, match="más de una vez"):
        build_manifest(EXPORT_ID, CASE_ID, DATE, [_file(EARLIER_ID), _file(EARLIER_ID)], HEAD)
    with pytest.raises(ValueError, match="zona horaria"):
        build_manifest(EXPORT_ID, CASE_ID, DATE.replace(tzinfo=None), [], HEAD)
