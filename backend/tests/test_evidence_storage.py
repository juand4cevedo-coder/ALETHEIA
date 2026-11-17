"""La carga multipart nunca publica un objeto parcial y puede limpiar uno publicado."""

import io
from pathlib import Path
from typing import Any

import boto3
import pytest
from botocore.exceptions import ClientError

from app.adapters import evidence_storage
from app.core.config import Settings

TEST_KEY = "evidences/00000000-0000-0000-0000-000000000003"


class FakeS3:
    def __init__(self) -> None:
        self.calls: list[str] = []
        self.parts: list[bytes] = []

    def create_multipart_upload(self, **_kwargs: Any) -> dict[str, str]:
        self.calls.append("create")
        return {"UploadId": "upload-1"}

    def upload_part(self, **kwargs: Any) -> dict[str, str]:
        self.calls.append("part")
        self.parts.append(kwargs["Body"])
        return {"ETag": f"etag-{len(self.parts)}"}

    def complete_multipart_upload(self, **_kwargs: Any) -> None:
        self.calls.append("complete")

    def abort_multipart_upload(self, **_kwargs: Any) -> None:
        self.calls.append("abort")

    def delete_object(self, **_kwargs: Any) -> None:
        self.calls.append("delete")

    def put_object(self, **_kwargs: Any) -> None:
        self.calls.append("put")

    def get_object(self, **_kwargs: Any) -> dict[str, io.BytesIO]:
        self.calls.append("get")
        return {"Body": io.BytesIO(b"objeto cifrado")}


@pytest.fixture
def fake_s3(monkeypatch: pytest.MonkeyPatch) -> FakeS3:
    fake = FakeS3()
    monkeypatch.setattr(boto3, "client", lambda *_args, **_kwargs: fake)
    return fake


def test_parte_incompleta_se_cancela(fake_s3: FakeS3) -> None:
    sink = evidence_storage.S3EvidenceSink("evidences/test", "aletheia-prueba")
    sink.write(b"a" * evidence_storage.PART_BYTES)
    sink.write(b"resto")
    sink.abort()
    assert fake_s3.calls == ["create", "part", "abort"]


def test_objeto_publicado_se_elimina_si_falla_la_base(fake_s3: FakeS3) -> None:
    sink = evidence_storage.S3EvidenceSink("evidences/test", "aletheia-prueba")
    sink.write(b"archivo cifrado")
    sink.commit()
    sink.abort()
    assert fake_s3.calls == ["put", "delete"]


def test_carga_grande_publica_partes_ordenadas(fake_s3: FakeS3) -> None:
    sink = evidence_storage.S3EvidenceSink("evidences/test", "aletheia-prueba")
    sink.write(b"a" * evidence_storage.PART_BYTES + b"b")
    sink.commit()
    assert fake_s3.calls == ["create", "part", "part", "complete"]
    assert len(fake_s3.parts[0]) == evidence_storage.PART_BYTES
    assert fake_s3.parts[1] == b"b"


def test_respuesta_perdida_al_completar_elimina_objeto_huerfano(
    fake_s3: FakeS3, monkeypatch: pytest.MonkeyPatch
) -> None:
    def complete_without_response(**_kwargs: Any) -> None:
        fake_s3.calls.append("complete")
        raise TimeoutError("respuesta perdida")

    def no_such_upload(**_kwargs: Any) -> None:
        fake_s3.calls.append("abort")
        raise ClientError(
            {"Error": {"Code": "NoSuchUpload", "Message": "already complete"}},
            "AbortMultipartUpload",
        )

    monkeypatch.setattr(fake_s3, "complete_multipart_upload", complete_without_response)
    monkeypatch.setattr(fake_s3, "abort_multipart_upload", no_such_upload)
    sink = evidence_storage.S3EvidenceSink("evidences/test", "aletheia-prueba")
    sink.write(b"a" * evidence_storage.PART_BYTES)
    with pytest.raises(TimeoutError):
        sink.commit()
    sink.abort()
    assert fake_s3.calls == ["create", "part", "complete", "abort", "delete"]


@pytest.mark.parametrize("key", ["../fuera", "C:/fuera", "evidences/../fuera", "evidences/abc"])
def test_almacenamiento_local_rechaza_rutas_fuera_del_esquema(tmp_path: Path, key: str) -> None:
    with pytest.raises(ValueError, match="clave de almacenamiento inválida"):
        evidence_storage.LocalEvidenceSink(tmp_path, key)
    assert not list(tmp_path.rglob("*"))


def test_almacenamiento_local_acepta_la_clave_generada(tmp_path: Path) -> None:
    sink = evidence_storage.LocalEvidenceSink(tmp_path, TEST_KEY)
    sink.write(b"cifrado")
    sink.commit()
    assert sink.path.read_bytes() == b"cifrado"


def test_lectura_s3_por_flujo_cierra_el_objeto(fake_s3: FakeS3) -> None:
    settings = Settings.model_construct(environment="production", evidence_bucket="aletheia-prueba")
    with evidence_storage.open_encrypted_evidence(settings, TEST_KEY) as stream:
        assert stream.read(6) == b"objeto"
    assert stream.closed
    assert fake_s3.calls == ["get"]


def test_lectura_rechaza_clave_fuera_del_esquema() -> None:
    settings = Settings.model_construct(environment="production", evidence_bucket="aletheia-prueba")
    with (
        pytest.raises(ValueError, match="clave de almacenamiento inválida"),
        evidence_storage.open_encrypted_evidence(settings, "../fuera"),
    ):
        pass
