"""Criterios C2 y C7 de TT-006: memoria y velocidad del cifrado por flujos con Tink.

Se ejecuta a mano desde C:\\Aletheia\\backend:

    uv run --group spike python -m spikes.tt006.medir_tink
"""

import io
import tempfile
import threading
import time
import uuid
from pathlib import Path

import psutil

from spikes.tt006 import cifrado_tink as ct
from spikes.tt006 import flujos

MIB = 1024 * 1024
TAMANO_MEMORIA = 2048 * MIB  # C2: 2 GiB que nunca existen completos
TAMANO_DESCIFRADO = 512 * MIB  # el texto cifrado de esta medición sí va a un archivo temporal


class _Vigia:
    """Mide en segundo plano la memoria residente del proceso y guarda el máximo."""

    def __init__(self) -> None:
        self._proceso = psutil.Process()
        self._parar = threading.Event()
        self.inicial = self._proceso.memory_info().rss
        self.maxima = self.inicial
        self._hilo = threading.Thread(target=self._medir, daemon=True)

    def _medir(self) -> None:
        while not self._parar.wait(0.02):
            self.maxima = max(self.maxima, self._proceso.memory_info().rss)

    def __enter__(self) -> _Vigia:
        self._hilo.start()
        return self

    def __exit__(self, *_: object) -> None:
        self._parar.set()
        self._hilo.join()


def _velocidad(tamano: int, segundos: float) -> str:
    return f"{tamano / MIB / segundos:,.0f} MiB/s"


def main() -> None:
    llave = ct.nueva_llave_de_caso()
    datos = ct.datos_asociados(uuid.uuid7(), uuid.uuid7())

    destino = flujos.Descarte()
    with _Vigia() as vigia:
        inicio = time.perf_counter()
        ct.cifrar(
            io.BufferedReader(flujos.Generado(TAMANO_MEMORIA)),
            io.BufferedWriter(destino),
            llave,
            datos,
        )
        segundos = time.perf_counter() - inicio
    extra = (vigia.maxima - vigia.inicial) / MIB
    print(f"C2 cifrar 2 GiB: memoria extra máxima {extra:.1f} MiB (criterio: menos de 100 MiB)")
    print(f"C7 cifrar con huella SHA-256: {_velocidad(TAMANO_MEMORIA, segundos)}")
    sobrecosto = destino.recibidos - TAMANO_MEMORIA
    print(f"   texto cifrado: {destino.recibidos:,} bytes; sobrecosto {sobrecosto:,} bytes")

    with tempfile.TemporaryDirectory() as carpeta:
        ruta = Path(carpeta) / "evidencia.bin"
        with ruta.open("wb") as archivo:
            ct.cifrar(io.BufferedReader(flujos.Generado(TAMANO_DESCIFRADO)), archivo, llave, datos)
        with ruta.open("rb") as archivo:
            inicio = time.perf_counter()
            ct.descifrar(archivo, io.BufferedWriter(flujos.Descarte()), llave, datos)
            segundos = time.perf_counter() - inicio
    print(f"C7 descifrar desde disco con huella: {_velocidad(TAMANO_DESCIFRADO, segundos)}")


if __name__ == "__main__":
    main()
