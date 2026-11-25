"""Radicado y plazo de respuesta de cada solicitud.

Los plazos son los que prometen la política de tratamiento de datos y los términos:

- Consulta sobre datos personales: diez días hábiles (Ley 1581 de 2012, art. 14).
- Reclamo sobre datos personales: quince días hábiles desde el día siguiente al recibo (art. 15).
- Petición, queja o reclamo de consumidor y solicitud de soporte: quince días hábiles.
- Reembolso: la devolución se paga en un máximo de quince días calendario.
"""

import datetime
from typing import Final, Literal
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.business_days import add_business_days

TicketCategory = Literal["support", "data_query", "data_claim", "consumer", "refund"]

BOGOTA: Final = ZoneInfo("America/Bogota")
_BUSINESS_DAYS: Final[dict[str, int]] = {
    "support": 15,
    "data_query": 10,
    "data_claim": 15,
    "consumer": 15,
}
_REFUND_CALENDAR_DAYS: Final = 15


def due_on(category: str, received_at: datetime.datetime) -> datetime.date:
    """Último día para responder, en el calendario de Colombia."""
    received = received_at.astimezone(BOGOTA).date()
    if category == "refund":
        return received + datetime.timedelta(days=_REFUND_CALENDAR_DAYS)
    return add_business_days(received, _BUSINESS_DAYS[category])


def next_filing_number(session: Session, received_at: datetime.datetime) -> str:
    """Radicado consecutivo y único: PQR, el año en Colombia y cinco cifras."""
    sequence = session.execute(text("SELECT nextval('support_ticket_filing_seq')")).scalar_one()
    return f"PQR-{received_at.astimezone(BOGOTA).year}-{int(sequence):05d}"


# Las solicitudes con contenido legal se conservan tres años desde su cierre: el plazo que tiene
# la autoridad para sancionar (Ley 1437 de 2011, art. 52). La migración 0059 aplica la misma
# regla en la base, así que este cálculo solo sirve para explicarla en la consola.
RETENTION_YEARS: Final = 3


def deletable_on(
    category: str, status: str, closed_at: datetime.datetime | None
) -> datetime.date | None:
    """Desde qué día se puede eliminar una solicitud, o None si sigue abierta."""
    if status != "closed" or closed_at is None:
        return None
    closed = closed_at.astimezone(BOGOTA).date()
    if category == "support":
        return closed
    try:
        return closed.replace(year=closed.year + RETENTION_YEARS) + datetime.timedelta(days=1)
    except ValueError:  # 29 de febrero
        return datetime.date(closed.year + RETENTION_YEARS, 3, 2)
