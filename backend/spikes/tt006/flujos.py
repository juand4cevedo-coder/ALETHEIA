"""Orígenes y destinos de prueba que no guardan el archivo en memoria ni en disco."""

import io
import os
from collections.abc import Buffer


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
