"""Criterio C5 de TT-006: leer la subida multipart por flujo, sin archivos temporales.

Con `UploadFile`, FastAPI (a través de Starlette) lee el formulario antes de llamar al
endpoint y guarda en un archivo temporal sin cifrar todo archivo de más de 1 MB: es el
riesgo RT-004. Aquí el endpoint recibe la petición sin leer el cuerpo y lo procesa por
fragmentos con el analizador incremental de python-multipart. Los campos de texto quedan
en memoria con un tope, y los bytes del archivo pasan directo al cifrado de Tink mientras
se calcula su huella.

El endpoint sigue siendo `def`, como se decidió el 23 de octubre: FastAPI lo ejecuta en
un hilo, y desde ese hilo cada fragmento del cuerpo se pide al bucle de eventos con
`anyio.from_thread.run`.
"""

import hashlib
import io
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Annotated, BinaryIO, Final

import anyio.from_thread
import tink
from fastapi import FastAPI, Form, HTTPException, Request, UploadFile
from python_multipart import MultipartParser
from python_multipart.multipart import parse_options_header
from tink import streaming_aead

from spikes.tt006 import cifrado_tink as ct
from spikes.tt006 import flujos

if TYPE_CHECKING:
    from python_multipart.multipart import MultipartCallbacks

# API-030: tipo y origen primero, el archivo al final.
CAMPOS_DE_TEXTO: Final = frozenset({"tipo", "origen"})
CAMPO_ARCHIVO: Final = "archivo"
TOPE_CAMPO_DE_TEXTO: Final = 1024


class SubidaInvalida(Exception):
    """El formulario no respeta el orden o los campos de API-030."""


class TamanoExcedido(Exception):
    """El archivo supera el tamaño máximo del plan."""


@dataclass(frozen=True)
class Recibido:
    campos: dict[str, str]
    huella: str
    tamano: int


class _Lector:
    """Recibe los eventos del analizador y decide qué hacer con cada parte del formulario."""

    def __init__(self, escribir_archivo: Callable[[bytes], object], tamano_maximo: int) -> None:
        self._escribir_archivo = escribir_archivo
        self._tamano_maximo = tamano_maximo
        self._huella = hashlib.sha256()
        self._campo_encabezado = bytearray()
        self._valor_encabezado = bytearray()
        self._disposicion = b""
        self._nombre = ""
        self._texto = bytearray()
        self.campos: dict[str, str] = {}
        self.tamano = 0
        self.archivo_completo = False

    @property
    def huella(self) -> str:
        return self._huella.hexdigest()

    def callbacks(self) -> MultipartCallbacks:
        return {
            "on_part_begin": self._inicio_de_parte,
            "on_header_field": self._campo_de_encabezado,
            "on_header_value": self._valor_de_encabezado,
            "on_header_end": self._fin_de_encabezado,
            "on_headers_finished": self._fin_de_encabezados,
            "on_part_data": self._datos,
            "on_part_end": self._fin_de_parte,
        }

    def _inicio_de_parte(self) -> None:
        if self.archivo_completo:
            raise SubidaInvalida("el archivo debe ser la última parte del formulario")
        self._disposicion = b""
        self._texto.clear()

    def _campo_de_encabezado(self, datos: bytes, inicio: int, fin: int) -> None:
        self._campo_encabezado += datos[inicio:fin]

    def _valor_de_encabezado(self, datos: bytes, inicio: int, fin: int) -> None:
        self._valor_encabezado += datos[inicio:fin]

    def _fin_de_encabezado(self) -> None:
        if bytes(self._campo_encabezado).lower() == b"content-disposition":
            self._disposicion = bytes(self._valor_encabezado)
        self._campo_encabezado.clear()
        self._valor_encabezado.clear()

    def _fin_de_encabezados(self) -> None:
        _, opciones = parse_options_header(self._disposicion)
        nombre = opciones.get(b"name", b"").decode("utf-8", errors="strict")
        if nombre == CAMPO_ARCHIVO:
            if CAMPOS_DE_TEXTO - self.campos.keys():
                raise SubidaInvalida("tipo y origen deben ir antes del archivo")
        elif nombre not in CAMPOS_DE_TEXTO or nombre in self.campos:
            raise SubidaInvalida("campo desconocido o repetido")
        self._nombre = nombre

    def _datos(self, datos: bytes, inicio: int, fin: int) -> None:
        trozo = datos[inicio:fin]
        if self._nombre != CAMPO_ARCHIVO:
            self._texto += trozo
            if len(self._texto) > TOPE_CAMPO_DE_TEXTO:
                raise SubidaInvalida("campo de texto demasiado largo")
            return
        self.tamano += len(trozo)
        if self.tamano > self._tamano_maximo:
            raise TamanoExcedido("el archivo supera el tamaño máximo del plan")
        self._huella.update(trozo)
        self._escribir_archivo(trozo)

    def _fin_de_parte(self) -> None:
        if self._nombre == CAMPO_ARCHIVO:
            self.archivo_completo = True
        else:
            self.campos[self._nombre] = self._texto.decode("utf-8", errors="strict")


def recibir_por_flujo(
    peticion: Request,
    destino: BinaryIO,
    llave: tink.KeysetHandle,
    datos: bytes,
    tamano_maximo: int,
) -> Recibido:
    """Lee el formulario por fragmentos y cifra el archivo en `destino` mientras llega.

    Se llama desde un endpoint `def`: cada fragmento se pide al bucle de eventos.
    """
    tipo, opciones = parse_options_header(peticion.headers.get("content-type"))
    frontera = opciones.get(b"boundary")
    if tipo != b"multipart/form-data" or not frontera:
        raise SubidaInvalida("se esperaba multipart/form-data")

    cuerpo = peticion.stream()

    async def siguiente() -> bytes | None:
        try:
            return await anext(cuerpo)
        except StopAsyncIteration:
            return None

    primitiva = llave.primitive(streaming_aead.StreamingAead)
    with primitiva.new_encrypting_stream(destino, datos) as cifrador:
        lector = _Lector(cifrador.write, tamano_maximo)
        analizador = MultipartParser(frontera, lector.callbacks())
        while (fragmento := anyio.from_thread.run(siguiente)) is not None:
            if fragmento:
                analizador.write(fragmento)
        analizador.finalize()

    if not lector.archivo_completo:
        raise SubidaInvalida("falta el archivo")
    return Recibido(campos=lector.campos, huella=lector.huella, tamano=lector.tamano)


def crear_app(tamano_maximo: int) -> FastAPI:
    """Dos endpoints de prueba: el formulario clásico de FastAPI y la lectura por flujo."""
    app = FastAPI()

    @app.post("/clasica")
    def subir_clasica(
        tipo: Annotated[str, Form()],
        origen: Annotated[str, Form()],
        archivo: UploadFile,
    ) -> dict[str, str]:
        huella = hashlib.sha256()
        while bloque := archivo.file.read(1024 * 1024):
            huella.update(bloque)
        return {"huella": huella.hexdigest()}

    @app.post("/flujo")
    def subir_por_flujo(peticion: Request) -> dict[str, object]:
        almacenamiento = flujos.Descarte()
        datos = ct.datos_asociados(uuid.uuid7(), uuid.uuid7())
        try:
            recibido = recibir_por_flujo(
                peticion,
                io.BufferedWriter(almacenamiento),
                ct.nueva_llave_de_caso(),
                datos,
                tamano_maximo,
            )
        except TamanoExcedido as error:
            raise HTTPException(status_code=413, detail=str(error)) from error
        except SubidaInvalida as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        return {
            "campos": recibido.campos,
            "huella": recibido.huella,
            "tamano": recibido.tamano,
            "cifrados": almacenamiento.recibidos,
        }

    return app
