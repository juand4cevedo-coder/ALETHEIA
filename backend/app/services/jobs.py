"""Cola de tareas en segundo plano (DAT-18): encolar y las reglas de reintento.

Una tarea se encola dentro de la misma transacción que la origina. Si esa transacción se
deshace, la tarea tampoco existe; si se confirma, el trabajador la ejecutará aunque la API se
caiga justo después. Se entrega al menos una vez, así que cada tipo debe poder ejecutarse dos
veces sin cambiar el resultado.
"""

import datetime
import re
import uuid
from collections.abc import Mapping
from typing import Final

from sqlalchemy.orm import Session

from app.models.jobs import JOB_KINDS
from app.repositories import jobs as jobs_repository

MAX_ATTEMPTS: Final = 5
# Lo que dura la reserva de una tarea en curso. Si el trabajador se cae, la tarea vuelve a
# tomarse cuando vence; ninguna tarea de hoy se acerca a este tiempo.
LEASE: Final = datetime.timedelta(minutes=5)
# Espera antes de cada reintento: 30 s, 1, 2 y 4 minutos.
_FIRST_RETRY: Final = datetime.timedelta(seconds=30)
# Las tareas terminadas o enterradas se borran a los 30 días (sección 9 de la especificación).
RETENTION: Final = datetime.timedelta(days=30)

# El payload lleva solo identificadores y valores cortos, nunca contenido de casos ni datos
# personales: esta forma cerrada impide guardar ahí un texto o un archivo por descuido.
_PAYLOAD_KEY: Final = re.compile(r"[a-z][a-z_]{0,39}")
_MAX_PAYLOAD_KEYS: Final = 10
_MAX_PAYLOAD_TEXT: Final = 100

type PayloadValue = str | int | bool | None


class PermanentJobError(Exception):
    """Reintentar no sirve: la tarea pasa directo a dead. El mensaje queda en last_error, así
    que nunca debe llevar datos personales."""


def _validated(payload: Mapping[str, object]) -> dict[str, PayloadValue]:
    if len(payload) > _MAX_PAYLOAD_KEYS:
        msg = f"El payload admite hasta {_MAX_PAYLOAD_KEYS} claves."
        raise ValueError(msg)
    validated: dict[str, PayloadValue] = {}
    for key, value in payload.items():
        if not _PAYLOAD_KEY.fullmatch(key):
            msg = f"Clave de payload inválida: {key!r}."
            raise ValueError(msg)
        if not isinstance(value, str | int | bool | None):
            msg = f"La clave {key} debe ser texto, número, booleano o nulo."
            raise TypeError(msg)
        if isinstance(value, str) and len(value) > _MAX_PAYLOAD_TEXT:
            msg = f"La clave {key} supera {_MAX_PAYLOAD_TEXT} caracteres."
            raise ValueError(msg)
        validated[key] = value
    return validated


def enqueue(
    session: Session,
    kind: str,
    payload: Mapping[str, object],
    idempotency_key: str,
    *,
    delay: datetime.timedelta = datetime.timedelta(0),
) -> None:
    """Encola una tarea en la transacción de session. Repetir la misma idempotency_key no crea
    una segunda tarea, así que reintentar una petición no duplica correos ni sellos."""
    if kind not in JOB_KINDS:
        msg = f"Tipo de tarea desconocido: {kind!r}."
        raise ValueError(msg)
    jobs_repository.insert_job(session, kind, _validated(payload), idempotency_key, delay)


def retry_delay(attempt: int) -> datetime.timedelta | None:
    """Espera antes de reintentar tras fallar el intento dado, o None si ya no quedan."""
    if attempt < 1:
        msg = "El primer intento es el número 1."
        raise ValueError(msg)
    if attempt >= MAX_ATTEMPTS:
        return None
    return _FIRST_RETRY * (1 << (attempt - 1))


def uuid7_floor(moment: datetime.datetime) -> uuid.UUID:
    """El menor UUID v7 posible del milisegundo dado: todo id creado antes es menor que él.

    Permite filtrar por fecha de creación con la llave primaria, sin columna ni índice extra.
    """
    milliseconds = int(moment.timestamp() * 1000)
    return uuid.UUID(int=(milliseconds << 80) | (0x7 << 76) | (0b10 << 62))


def purge_finished(session: Session, now: datetime.datetime) -> int:
    """Borra las tareas terminadas o enterradas hace más de 30 días. Lo ejecuta el trabajador."""
    return jobs_repository.delete_finished_before(session, uuid7_floor(now - RETENTION))
