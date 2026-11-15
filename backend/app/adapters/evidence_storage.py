"""Destino de escritura incremental para evidencia cifrada.

El cifrador cierra el flujo antes de que la API valide el formulario. Por eso cerrar no
publica el objeto: solo ``commit`` lo hace visible, y ``abort`` limpia cualquier resto.
"""

import io
import os
import re
from collections.abc import Buffer, Iterator
from contextlib import closing, contextmanager
from pathlib import Path
from typing import BinaryIO, Final, Protocol, cast

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import Settings

PART_BYTES: Final = 8 * 1024 * 1024
PRODUCTION_BUCKET: Final = "aletheia-prod-evidencias-047938357957"
UUID_PART: Final = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
STORAGE_KEY_PATTERN: Final = re.compile(rf"evidences/{UUID_PART}")


class EvidenceSink(Protocol):
    def write(self, data: Buffer) -> int: ...

    def flush(self) -> None: ...

    def close(self) -> None: ...

    def commit(self) -> None: ...

    def abort(self) -> None: ...


class LocalEvidenceSink(io.RawIOBase):
    """Archivo cifrado local para desarrollo; el nombre temporal nunca contiene texto claro."""

    def __init__(self, root: Path, key: str) -> None:
        if STORAGE_KEY_PATTERN.fullmatch(key) is None:
            raise ValueError("clave de almacenamiento inválida")
        self.path = root / key
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.partial = self.path.with_name(self.path.name + ".part")
        self._file = self.partial.open("xb")

    def writable(self) -> bool:
        return True

    def write(self, data: Buffer) -> int:
        return self._file.write(data)

    def flush(self) -> None:
        if not self._file.closed:
            self._file.flush()

    def close(self) -> None:
        if not hasattr(self, "_file"):
            return
        if not self._file.closed:
            self._file.close()
        super().close()

    def commit(self) -> None:
        self.close()
        os.replace(self.partial, self.path)

    def abort(self) -> None:
        self.close()
        self.partial.unlink(missing_ok=True)
        self.path.unlink(missing_ok=True)


class S3EvidenceSink(io.RawIOBase):
    """Carga multipart a S3 con memoria acotada, sin disco temporal."""

    def __init__(self, key: str) -> None:
        self.key = key
        self.client = boto3.client(
            "s3",
            config=Config(connect_timeout=5, read_timeout=30, retries={"max_attempts": 3}),
        )
        self._buffer = bytearray()
        self._upload_id: str | None = None
        self._parts: list[dict[str, int | str]] = []
        self._published = False
        self._commit_attempted = False

    def writable(self) -> bool:
        return True

    def write(self, data: Buffer) -> int:
        if self.closed:
            raise ValueError("flujo cerrado")
        chunk = bytes(data)
        self._buffer.extend(chunk)
        while len(self._buffer) >= PART_BYTES:
            self._part(bytes(self._buffer[:PART_BYTES]))
            del self._buffer[:PART_BYTES]
        return len(chunk)

    def _part(self, data: bytes) -> None:
        if self._upload_id is None:
            response = self.client.create_multipart_upload(Bucket=PRODUCTION_BUCKET, Key=self.key)
            self._upload_id = response["UploadId"]
        number = len(self._parts) + 1
        response = self.client.upload_part(
            Bucket=PRODUCTION_BUCKET,
            Key=self.key,
            UploadId=self._upload_id,
            PartNumber=number,
            Body=data,
        )
        self._parts.append({"PartNumber": number, "ETag": response["ETag"]})

    def commit(self) -> None:
        self.close()
        self._commit_attempted = True
        if self._upload_id is None:
            self.client.put_object(Bucket=PRODUCTION_BUCKET, Key=self.key, Body=bytes(self._buffer))
        else:
            if self._buffer:
                self._part(bytes(self._buffer))
            self.client.complete_multipart_upload(
                Bucket=PRODUCTION_BUCKET,
                Key=self.key,
                UploadId=self._upload_id,
                MultipartUpload={"Parts": self._parts},
            )
            self._upload_id = None
        self._buffer.clear()
        self._published = True

    def abort(self) -> None:
        self._buffer.clear()
        try:
            if self._upload_id is not None:
                try:
                    self.client.abort_multipart_upload(
                        Bucket=PRODUCTION_BUCKET, Key=self.key, UploadId=self._upload_id
                    )
                except ClientError as exc:
                    if exc.response["Error"]["Code"] != "NoSuchUpload":
                        raise
                self._upload_id = None
        finally:
            # Una respuesta perdida de CompleteMultipartUpload deja el objeto publicado
            # aunque el cliente aún conserve el identificador de la carga.
            if self._published or self._commit_attempted:
                self.client.delete_object(Bucket=PRODUCTION_BUCKET, Key=self.key)
                self._published = False


def new_evidence_sink(settings: Settings, key: str) -> EvidenceSink:
    if settings.environment == "production":
        return S3EvidenceSink(key)
    return LocalEvidenceSink(Path(".local/evidence"), key)


@contextmanager
def open_encrypted_evidence(settings: Settings, key: str) -> Iterator[BinaryIO]:
    """Lee el objeto cifrado sin cargarlo completo; acepta solo claves generadas."""
    if STORAGE_KEY_PATTERN.fullmatch(key) is None:
        raise ValueError("clave de almacenamiento inválida")
    if settings.environment == "production":
        client = boto3.client(
            "s3", config=Config(connect_timeout=5, read_timeout=30, retries={"max_attempts": 3})
        )
        body = client.get_object(Bucket=PRODUCTION_BUCKET, Key=key)["Body"]
        with closing(cast("BinaryIO", body)) as stream:
            yield stream
    else:
        with (Path(".local/evidence") / key).open("rb") as stream:
            yield stream
