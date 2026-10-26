"""Orígenes y destinos de prueba que no guardan el archivo en memoria ni en disco."""

import io
import os
import threading
from collections.abc import Buffer

import psutil


class Generado(io.RawIOBase):
    """Origen de `total` bytes que se producen al leer, repitiendo un bloque aleatorio de 1 MiB.

    Repetir el bloque evita que el costo de generar azar se mezcle con la medición del cifrado.
    """

    def __init__(self, total: int) -> None:
        self._restante = total
        self._patron = os.urandom(1024 * 1024)

    def readable(self) -> bool:
        return True

    def readinto(self, buffer: Buffer, /) -> int:
        vista = memoryview(buffer).cast("B")
        n = min(len(vista), self._restante, len(self._patron))
        vista[:n] = self._patron[:n]
        self._restante -= n
        return n


class Descarte(io.RawIOBase):
    """Destino que cuenta lo que recibe y lo descarta."""

    def __init__(self) -> None:
        self.recibidos = 0

    def writable(self) -> bool:
        return True

    def write(self, datos: Buffer, /) -> int:
        n = memoryview(datos).nbytes
        self.recibidos += n
        return n


class VigiaDeMemoria:
    """Mide en segundo plano la memoria residente del proceso y guarda el máximo."""

    def __init__(self) -> None:
        self._proceso = psutil.Process()
        self._parar = threading.Event()
        self.inicial = self._proceso.memory_info().rss
        self.maxima = self.inicial
        self._hilo = threading.Thread(target=self._medir, daemon=True)

    @property
    def extra_mib(self) -> float:
        return (self.maxima - self.inicial) / (1024 * 1024)

    def _medir(self) -> None:
        while not self._parar.wait(0.02):
            self.maxima = max(self.maxima, self._proceso.memory_info().rss)

    def __enter__(self) -> VigiaDeMemoria:
        self._hilo.start()
        return self

    def __exit__(self, *_: object) -> None:
        self._parar.set()
        self._hilo.join()
