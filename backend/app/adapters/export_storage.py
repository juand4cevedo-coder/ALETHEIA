"""Almacenamiento de ZIP de preservación con publicación atómica y clave por exportación."""

import io
import os
import re
import tempfile
import uuid
from collections.abc import Buffer, Iterator
from contextlib import closing, contextmanager
from pathlib import Path
from typing import BinaryIO, Final, cast

import boto3
from botocore.config import Config

from app.adapters.evidence_storage import (
    UUID_PART,
    EvidenceSink,
    S3EvidenceSink,
)
from app.core.config import Settings

EXPORT_KEY_PATTERN: Final = re.compile(rf"exports/{UUID_PART}\.zip")
LOCAL_ROOT: Final = Path(".local")
READ_CHUNK_BYTES: Final = 1024 * 1024


def export_storage_key(export_id: uuid.UUID) -> str:
    return f"exports/{export_id}.zip"


def _checked_key(key: str) -> str:
    if EXPORT_KEY_PATTERN.fullmatch(key) is None:
        raise ValueError("Clave de paquete inválida.")
    return key


class LocalExportSink(io.RawIOBase):
    """Escribe en un temporal y solo lo publica después de cerrar el ZIP completo."""

    def __init__(self, key: str, *, root: Path = LOCAL_ROOT) -> None:
        _checked_key(key)
        self.path = root / key
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._file = tempfile.NamedTemporaryFile(  # noqa: SIM115 - se cierra en commit/abort
            mode="wb",
            prefix=f"{self.path.name}.",
            suffix=".part",
            dir=self.path.parent,
            delete=False,
        )
        self._partial = Path(self._file.name)
        self._published = False

    def writable(self) -> bool:
        return True

    def write(self, data: Buffer) -> int:
        return self._file.write(data)

    def flush(self) -> None:
        if hasattr(self, "_file") and not self._file.closed:
            self._file.flush()

    def close(self) -> None:
        if not hasattr(self, "_file"):
            return
        if not self._file.closed:
            self._file.close()
        super().close()

    def commit(self) -> None:
        self.close()
        os.replace(self._partial, self.path)
        self._published = True

    def abort(self) -> None:
        self.close()
        self._partial.unlink(missing_ok=True)
        if self._published:
            self.path.unlink(missing_ok=True)
            self._published = False


def new_export_sink(settings: Settings, export_id: uuid.UUID) -> EvidenceSink:
    key = export_storage_key(export_id)
    if settings.environment == "production":
        return S3EvidenceSink(key, settings.evidence_bucket_name())
    return LocalExportSink(key)


@contextmanager
def open_export(settings: Settings, key: str) -> Iterator[BinaryIO]:
    """Lee el objeto completo con credenciales vigentes, sin crear una URL S3 de larga vida."""
    _checked_key(key)
    if settings.environment == "production":
        client = boto3.client(
            "s3", config=Config(connect_timeout=5, read_timeout=30, retries={"max_attempts": 3})
        )
        body = client.get_object(Bucket=settings.evidence_bucket_name(), Key=key)["Body"]
        with closing(cast("BinaryIO", body)) as stream:
            yield stream
    else:
        with (LOCAL_ROOT / key).open("rb") as stream:
            yield stream


def export_chunks(settings: Settings, key: str) -> Iterator[bytes]:
    with open_export(settings, key) as source:
        while chunk := source.read(READ_CHUNK_BYTES):
            yield chunk


def delete_export(settings: Settings, key: str) -> None:
    _checked_key(key)
    if settings.environment == "production":
        client = boto3.client(
            "s3", config=Config(connect_timeout=5, read_timeout=30, retries={"max_attempts": 3})
        )
        client.delete_object(Bucket=settings.evidence_bucket_name(), Key=key)
    else:
        (LOCAL_ROOT / key).unlink(missing_ok=True)
