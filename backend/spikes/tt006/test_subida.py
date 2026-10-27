"""Criterio C5 de TT-006: la subida por flujo no deja el archivo sin cifrar en disco.

Las pruebas llaman a la aplicación como lo hace el servidor (ASGI) y le entregan el cuerpo
en fragmentos de 1 MiB generados al vuelo. Un gancho de auditoría de Python registra
cualquier archivo que se abra en la carpeta temporal mientras se atiende la petición.
"""

import hashlib
import io
import json
import os
import sys
import tempfile
import threading
from collections.abc import Iterator
from typing import Any

import anyio
import pytest
from fastapi import FastAPI
from starlette.types import Message

from spikes.tt006 import flujos
from spikes.tt006.subida import crear_app

MIB = 1024 * 1024
FRONTERA = b"----aletheia-tt006"
_CARPETA_TEMPORAL = os.path.normcase(tempfile.gettempdir())
_vigilando = threading.Event()
_abiertos: list[str] = []


def _vigia(evento: str, argumentos: tuple[Any, ...]) -> None:
    """Anota todo archivo abierto en la carpeta temporal mientras se vigila."""
    if not _vigilando.is_set() or not argumentos:
        return
    if evento in {"tempfile.mkstemp", "tempfile.mkdtemp"}:
        _abiertos.append(f"{evento} {argumentos[0]}")
    elif evento == "open" and isinstance(argumentos[0], str | bytes):
        ruta = os.path.normcase(os.fsdecode(argumentos[0]))
        if ruta.startswith(_CARPETA_TEMPORAL):
            _abiertos.append(ruta)


# Un gancho de auditoría no se puede quitar; solo actúa mientras `_vigilando` está activo.
sys.addaudithook(_vigia)


class _Huella:
    """Huella del archivo enviado, calculada mientras se genera el cuerpo."""

    def __init__(self) -> None:
        self.calculo = hashlib.sha256()


def _parte_de_texto(nombre: str, valor: str) -> bytes:
    return (
        b"--" + FRONTERA + b"\r\n"
        b'Content-Disposition: form-data; name="'
        + nombre.encode()
        + b'"\r\n\r\n'
        + valor.encode()
        + b"\r\n"
    )


def _cuerpo(campos: list[tuple[str, str]], tamano_archivo: int, huella: _Huella) -> Iterator[bytes]:
    """Genera el formulario por fragmentos: los campos de texto y luego el archivo."""
    for nombre, valor in campos:
        yield _parte_de_texto(nombre, valor)
    yield (
        b"--" + FRONTERA + b"\r\n"
        b'Content-Disposition: form-data; name="archivo"; filename="extracto.pdf"\r\n'
        b"Content-Type: application/pdf\r\n\r\n"
    )
    origen = io.BufferedReader(flujos.Generado(tamano_archivo))
    while bloque := origen.read(MIB):
        huella.calculo.update(bloque)
        yield bloque
    yield b"\r\n--" + FRONTERA + b"--\r\n"


async def _enviar(app: FastAPI, ruta: str, cuerpo: Iterator[bytes]) -> tuple[int, Any]:
    """Atiende una petición POST como lo haría Uvicorn, entregando el cuerpo por partes."""
    alcance = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": ruta,
        "raw_path": ruta.encode(),
        "root_path": "",
        "query_string": b"",
        "headers": [(b"content-type", b"multipart/form-data; boundary=" + FRONTERA)],
        "server": ("prueba", 80),
        "client": ("prueba", 50000),
    }
    terminado = False
    estado = 0
    respuesta = bytearray()

    async def recibir() -> Message:
        nonlocal terminado
        if terminado:
            return {"type": "http.disconnect"}
        bloque = next(cuerpo, None)
        if bloque is None:
            terminado = True
            return {"type": "http.request", "body": b"", "more_body": False}
        return {"type": "http.request", "body": bloque, "more_body": True}

    async def enviar(mensaje: Message) -> None:
        nonlocal estado
        if mensaje["type"] == "http.response.start":
            estado = mensaje["status"]
        elif mensaje["type"] == "http.response.body":
            respuesta.extend(mensaje.get("body", b""))

    await app(alcance, recibir, enviar)
    return estado, json.loads(respuesta)


def _atender_vigilando(app: FastAPI, ruta: str, cuerpo: Iterator[bytes]) -> tuple[int, Any]:
    _abiertos.clear()
    _vigilando.set()
    try:
        return anyio.run(_enviar, app, ruta, cuerpo)
    finally:
        _vigilando.clear()


CAMPOS = [("tipo", "documento"), ("origen", "Enviado por el cliente por correo")]


def test_el_formulario_clasico_deja_el_archivo_en_disco() -> None:
    """Evidencia de RT-004: con UploadFile, 2 MB ya terminan en un archivo temporal."""
    huella = _Huella()
    estado, cuerpo = _atender_vigilando(
        crear_app(tamano_maximo=5 * 1024 * MIB), "/clasica", _cuerpo(CAMPOS, 2 * MIB, huella)
    )
    assert estado == 200
    assert cuerpo["huella"] == huella.calculo.hexdigest()
    assert _abiertos, "se esperaba un archivo temporal"


def test_la_lectura_por_flujo_no_crea_archivos_temporales() -> None:
    huella = _Huella()
    tamano = 300 * MIB
    with flujos.VigiaDeMemoria() as memoria:
        estado, cuerpo = _atender_vigilando(
            crear_app(tamano_maximo=5 * 1024 * MIB), "/flujo", _cuerpo(CAMPOS, tamano, huella)
        )
    assert estado == 200
    assert cuerpo["huella"] == huella.calculo.hexdigest()
    assert cuerpo["tamano"] == tamano
    assert cuerpo["cifrados"] > tamano
    assert cuerpo["campos"] == dict(CAMPOS)
    assert _abiertos == []
    # Si el cuerpo se acumulara en algún punto, la memoria subiría unos 300 MiB.
    assert memoria.extra_mib < 100


def test_el_archivo_debe_ir_al_final() -> None:
    estado, _ = _atender_vigilando(
        crear_app(tamano_maximo=5 * 1024 * MIB),
        "/flujo",
        _cuerpo([("tipo", "documento")], 10, _Huella()),
    )
    assert estado == 422


def test_un_archivo_mayor_al_tope_del_plan_se_rechaza() -> None:
    estado, _ = _atender_vigilando(
        crear_app(tamano_maximo=MIB), "/flujo", _cuerpo(CAMPOS, 3 * MIB, _Huella())
    )
    assert estado == 413
    assert _abiertos == []


@pytest.mark.parametrize("nombre", ["tipo", "desconocido"])
def test_campos_repetidos_o_desconocidos_se_rechazan(nombre: str) -> None:
    campos = [*CAMPOS, (nombre, "x")]
    estado, _ = _atender_vigilando(
        crear_app(tamano_maximo=5 * 1024 * MIB), "/flujo", _cuerpo(campos, 10, _Huella())
    )
    assert estado == 422
