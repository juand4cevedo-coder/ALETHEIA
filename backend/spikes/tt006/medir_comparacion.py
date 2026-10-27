"""Comparación para ADR-014: de dónde sale el tiempo del cifrado en este equipo.

Mide por separado la huella SHA-256, el cifrado de Tink, el de cryptography por fragmentos
y el flujo real (Tink con huella), sobre 1 GiB generado al vuelo. También muestra si el
equipo está conectado al cargador, porque el ahorro de energía baja la velocidad.

Se ejecuta a mano desde C:\\Aletheia\\backend:

    uv run --group spike python -m spikes.tt006.medir_comparacion
"""

import hashlib
import io
import time
import uuid
from collections.abc import Callable

import psutil
from tink import streaming_aead

from spikes.tt006 import cifrado_cryptography as cc
from spikes.tt006 import cifrado_tink as ct
from spikes.tt006 import flujos

MIB = 1024 * 1024
TAMANO = 1024 * MIB


def _solo_huella() -> None:
    origen = io.BufferedReader(flujos.Generado(TAMANO))
    huella = hashlib.sha256()
    while bloque := origen.read(MIB):
        huella.update(bloque)


def _solo_tink() -> None:
    llave = ct.nueva_llave_de_caso()
    primitiva = llave.primitive(streaming_aead.StreamingAead)
    origen = io.BufferedReader(flujos.Generado(TAMANO))
    destino = io.BufferedWriter(flujos.Descarte())
    with primitiva.new_encrypting_stream(destino, b"medicion") as cifrador:
        while bloque := origen.read(MIB):
            cifrador.write(bloque)


def _cryptography_con_huella() -> None:
    cc.cifrar(
        io.BufferedReader(flujos.Generado(TAMANO)),
        io.BufferedWriter(flujos.Descarte()),
        cc.nueva_llave(),
        b"medicion",
    )


def _tink_con_huella() -> None:
    ct.cifrar(
        io.BufferedReader(flujos.Generado(TAMANO)),
        io.BufferedWriter(flujos.Descarte()),
        ct.nueva_llave_de_caso(),
        ct.datos_asociados(uuid.uuid7(), uuid.uuid7()),
    )


def _medir(nombre: str, tarea: Callable[[], None]) -> None:
    inicio = time.perf_counter()
    tarea()
    segundos = time.perf_counter() - inicio
    print(f"{nombre:<36} {TAMANO / MIB / segundos:>8,.0f} MiB/s")


def main() -> None:
    bateria = psutil.sensors_battery()
    cargador = "sin batería" if bateria is None else ("sí" if bateria.power_plugged else "no")
    frecuencia = psutil.cpu_freq()
    print(f"Cargador conectado: {cargador}")
    if frecuencia is not None:
        print(
            f"Frecuencia del procesador: {frecuencia.current:,.0f} MHz (máx. {frecuencia.max:,.0f})"
        )
    print()
    _medir("Solo huella SHA-256", _solo_huella)
    _medir("Solo cifrado Tink", _solo_tink)
    _medir("cryptography por fragmentos + huella", _cryptography_con_huella)
    _medir("Tink + huella (flujo real)", _tink_con_huella)


if __name__ == "__main__":
    main()
