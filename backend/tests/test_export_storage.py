"""Los ZIP locales se publican solo después de cerrar y se eliminan si falla la tarea."""

import io
import uuid
import zipfile
from pathlib import Path
from types import SimpleNamespace
from typing import cast

import pytest

from app.adapters import export_storage
from app.adapters.export_storage import (
    LocalExportSink,
    delete_export,
    export_chunks,
    export_storage_key,
)
from app.core.config import Settings

EXPORT_ID = uuid.UUID("01890a5d-ac96-774b-bcce-b302099a8070")


def test_publicacion_atomica_y_lectura_por_fragmentos(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    key = export_storage_key(EXPORT_ID)
    sink = LocalExportSink(key, root=tmp_path)
    assert not sink.path.exists()
    with zipfile.ZipFile(sink, mode="w", allowZip64=True) as archive:
        archive.writestr("manifest.json", b"contenido")
    assert not sink.path.exists()
    sink.commit()
    assert sink.path.exists()
    with zipfile.ZipFile(io.BytesIO(sink.path.read_bytes())) as archive:
        assert archive.read("manifest.json") == b"contenido"

    monkeypatch.setattr(export_storage, "LOCAL_ROOT", tmp_path)
    settings = cast("Settings", SimpleNamespace(environment="development"))
    assert b"".join(export_chunks(settings, key)) == sink.path.read_bytes()
    delete_export(settings, key)
    assert not sink.path.exists()


def test_abort_descarta_temporal_y_objeto_publicado(tmp_path: Path) -> None:
    key = export_storage_key(EXPORT_ID)
    sink = LocalExportSink(key, root=tmp_path)
    sink.write(b"parcial")
    sink.abort()
    assert not sink.path.exists()
    assert list(tmp_path.rglob("*.part")) == []

    published = LocalExportSink(key, root=tmp_path)
    published.write(b"listo")
    published.commit()
    published.abort()
    assert not published.path.exists()


@pytest.mark.parametrize("key", ["../secreto", "exports/otro.zip", "evidences/abc"])
def test_rechaza_claves_ajenas_al_paquete(key: str, tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="Clave"):
        LocalExportSink(key, root=tmp_path)
    settings = cast("Settings", SimpleNamespace(environment="development"))
    with pytest.raises(ValueError, match="Clave"):
        delete_export(settings, key)
