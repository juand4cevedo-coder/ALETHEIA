"""Analizador multipart incremental: nunca materializa el archivo en claro."""

import hashlib
from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

import anyio.from_thread
from fastapi import Request
from python_multipart import MultipartParser
from python_multipart.multipart import parse_options_header

if TYPE_CHECKING:
    from python_multipart.multipart import MultipartCallbacks

TEXT_FIELDS: Final = frozenset({"tipo", "origen"})
TEXT_LIMIT: Final = 1024
HEADER_LIMIT: Final = 4096


class InvalidUpload(ValueError):
    pass


class FileTooLarge(ValueError):
    pass


@dataclass(frozen=True)
class ReceivedFile:
    declared_type: str
    declared_origin: str
    filename: str
    content_type: str
    sha256: bytes
    size: int


class _Reader:
    def __init__(self, write: Callable[[bytes], object], limit: int) -> None:
        self.write = write
        self.limit = limit
        self.hash = hashlib.sha256()
        self.head = bytearray()
        self.size = 0
        self.fields: dict[str, str] = {}
        self.filename = ""
        self.finished = False
        self.name = ""
        self.text = bytearray()
        self.header_name = bytearray()
        self.header_value = bytearray()
        self.disposition = b""

    def callbacks(self) -> MultipartCallbacks:
        return {
            "on_part_begin": self.begin,
            "on_header_field": self.header_field,
            "on_header_value": self.header_value_part,
            "on_header_end": self.header_end,
            "on_headers_finished": self.headers_finished,
            "on_part_data": self.data,
            "on_part_end": self.end,
        }

    def begin(self) -> None:
        if self.finished:
            raise InvalidUpload("el archivo debe ser la última parte")
        self.disposition = b""
        self.text.clear()

    def header_field(self, data: bytes, start: int, end: int) -> None:
        self.header_name.extend(data[start:end])
        if len(self.header_name) > HEADER_LIMIT:
            raise InvalidUpload("encabezado demasiado largo")

    def header_value_part(self, data: bytes, start: int, end: int) -> None:
        self.header_value.extend(data[start:end])
        if len(self.header_value) > HEADER_LIMIT:
            raise InvalidUpload("encabezado demasiado largo")

    def header_end(self) -> None:
        name = bytes(self.header_name).lower()
        if name == b"content-disposition":
            self.disposition = bytes(self.header_value)
        self.header_name.clear()
        self.header_value.clear()

    def headers_finished(self) -> None:
        _, options = parse_options_header(self.disposition)
        name = options.get(b"name", b"").decode("utf-8", errors="strict")
        if name == "archivo":
            if TEXT_FIELDS - self.fields.keys() or self.filename:
                raise InvalidUpload("tipo y origen deben ir antes del archivo")
            filename = options.get(b"filename", b"").decode("utf-8", errors="strict")
            filename = filename.replace("\\", "/").split("/")[-1]
            if not filename or len(filename) > 255 or "\x00" in filename:
                raise InvalidUpload("nombre de archivo inválido")
            self.filename = filename
        elif name not in TEXT_FIELDS or name in self.fields:
            raise InvalidUpload("campo desconocido o repetido")
        self.name = name

    def data(self, data: bytes, start: int, end: int) -> None:
        chunk = data[start:end]
        if self.name != "archivo":
            self.text.extend(chunk)
            if len(self.text) > TEXT_LIMIT:
                raise InvalidUpload("campo de texto demasiado largo")
            return
        self.size += len(chunk)
        if self.size > self.limit:
            raise FileTooLarge("el archivo supera el tamaño máximo del plan")
        self.hash.update(chunk)
        if len(self.head) < 512:
            self.head.extend(chunk[: 512 - len(self.head)])
        self.write(chunk)

    def end(self) -> None:
        if self.name == "archivo":
            self.finished = True
        else:
            value = self.text.decode("utf-8", errors="strict").strip()
            if self.name == "tipo" and value not in {
                "chat",
                "email",
                "audio",
                "image",
                "document",
                "other",
            }:
                raise InvalidUpload("tipo de evidencia inválido")
            if self.name == "origen" and not 1 <= len(value) <= 500:
                raise InvalidUpload("origen inválido")
            self.fields[self.name] = value


def _detected_type(head: bytes) -> str:
    if head.startswith(b"%PDF-"):
        return "application/pdf"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if head.startswith(b"PK\x03\x04"):
        return "application/zip"
    if head.startswith(b"RIFF") and head[8:12] == b"WAVE":
        return "audio/wav"
    if head.startswith(b"ID3"):
        return "audio/mpeg"
    try:
        text = head.decode("utf-8")
    except UnicodeDecodeError:
        return "application/octet-stream"
    return (
        "text/plain"
        if all(char.isprintable() or char in "\n\r\t" for char in text)
        else "application/octet-stream"
    )


def receive(request: Request, write: Callable[[bytes], object], limit: int) -> ReceivedFile:
    kind, options = parse_options_header(request.headers.get("content-type"))
    boundary = options.get(b"boundary")
    if kind != b"multipart/form-data" or not boundary or len(boundary) > 200:
        raise InvalidUpload("se esperaba multipart/form-data")
    reader = _Reader(write, limit)
    parser = MultipartParser(boundary, reader.callbacks())
    stream = request.stream()

    async def next_chunk() -> bytes | None:
        try:
            return await anext(stream)
        except StopAsyncIteration:
            return None

    while (chunk := anyio.from_thread.run(next_chunk)) is not None:
        if chunk:
            parser.write(chunk)
    parser.finalize()
    if not reader.finished or reader.size == 0:
        raise InvalidUpload("falta un archivo con contenido")
    declared_type = reader.fields["tipo"]
    declared_origin = reader.fields["origen"]
    return ReceivedFile(
        declared_type,
        declared_origin,
        reader.filename,
        _detected_type(bytes(reader.head)),
        reader.hash.digest(),
        reader.size,
    )
