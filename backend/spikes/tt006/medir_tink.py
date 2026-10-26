"""Criterios C2 y C7 de TT-006: memoria y velocidad del cifrado por flujos con Tink.

Se ejecuta a mano desde C:\\Aletheia\\backend:

    uv run --group spike python -m spikes.tt006.medir_tink
"""

import io
import tempfile
import time
import uuid
from pathlib import Path

from spikes.tt006 import cifrado_tink as ct
from spikes.tt006 import flujos

MIB = 1024 * 1024
TAMANO_MEMORIA = 2048 * MIB  # C2: 2 GiB que nunca existen completos
TAMANO_DESCIFRADO = 512 * MIB  # el texto cifrado de esta medición sí va a un archivo temporal


def _velocidad(tamano: int, segundos: float) -> str:
    return f"{tamano / MIB / segundos:,.0f} MiB/s"


def main() -> None:
    llave = ct.nueva_llave_de_caso()
    datos = ct.datos_asociados(uuid.uuid7(), uuid.uuid7())

    destino = flujos.Descarte()
    with flujos.VigiaDeMemoria() as vigia:
        inicio = time.perf_counter()
        ct.cifrar(
            io.BufferedReader(flujos.Generado(TAMANO_MEMORIA)),
            io.BufferedWriter(destino),
            llave,
            datos,
        )
        segundos = time.perf_counter() - inicio
    extra = vigia.extra_mib
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
