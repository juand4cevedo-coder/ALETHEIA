"""La carga multipart nunca publica un objeto parcial y puede limpiar uno publicado."""

from typing import Any

import boto3
import pytest

from app.adapters import evidence_storage


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


@pytest.fixture
def fake_s3(monkeypatch: pytest.MonkeyPatch) -> FakeS3:
    fake = FakeS3()
    monkeypatch.setattr(boto3, "client", lambda *_args, **_kwargs: fake)
    return fake


def test_parte_incompleta_se_cancela(fake_s3: FakeS3) -> None:
    sink = evidence_storage.S3EvidenceSink("evidences/test")
    sink.write(b"a" * evidence_storage.PART_BYTES)
    sink.write(b"resto")
    sink.abort()
    assert fake_s3.calls == ["create", "part", "abort"]


def test_objeto_publicado_se_elimina_si_falla_la_base(fake_s3: FakeS3) -> None:
    sink = evidence_storage.S3EvidenceSink("evidences/test")
    sink.write(b"archivo cifrado")
    sink.commit()
    sink.abort()
    assert fake_s3.calls == ["put", "delete"]


def test_carga_grande_publica_partes_ordenadas(fake_s3: FakeS3) -> None:
    sink = evidence_storage.S3EvidenceSink("evidences/test")
    sink.write(b"a" * evidence_storage.PART_BYTES + b"b")
    sink.commit()
    assert fake_s3.calls == ["create", "part", "part", "complete"]
    assert len(fake_s3.parts[0]) == evidence_storage.PART_BYTES
    assert fake_s3.parts[1] == b"b"
