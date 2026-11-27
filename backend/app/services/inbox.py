"""Avisos dentro de la aplicación: la campana del encabezado y su panel (ADR-063).

Los avisos se dejan en la misma transacción que el hecho que los origina: si la tarea no se
crea, tampoco queda el aviso. No copian datos del expediente ni mensajes del cliente: nombran el
caso y llevan el enlace, igual que los correos. Nadie recibe aviso de lo que hizo él mismo.

Se insertan con SQL directo y sin RETURNING: la política de fila deja escribir un aviso para un
colega del despacho, pero no leerlo, y un RETURNING pediría leerlo.
"""

import datetime
import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Final, Literal

from sqlalchemy import func, insert, select, update
from sqlalchemy.orm import Session

from app.models import Notification
from app.services.sessions import Principal

Kind = Literal["task_assigned", "case_member_added", "client_message", "member_joined"]

# Cuántos avisos muestra el panel. Los más antiguos siguen ahí, ya sin interés.
PAGE_SIZE: Final = 30
_TITLE_MAX: Final = 160
_BODY_MAX: Final = 300


@dataclass(frozen=True, slots=True)
class Inbox:
    items: list[Notification]
    unread: int


class NotificationNotFoundError(Exception):
    """El aviso no existe o es de otra persona."""


def _cut(text: str, limit: int) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "."


def notify(
    session: Session,
    *,
    organization_id: uuid.UUID,
    recipients: Iterable[uuid.UUID],
    kind: Kind,
    title: str,
    link: str,
    body: str | None = None,
    actor_id: uuid.UUID | None = None,
) -> int:
    """Deja el aviso a cada destinataria, menos a quien hizo la acción. Devuelve cuántos dejó."""
    now = datetime.datetime.now(datetime.UTC)
    rows = [
        {
            "id": uuid.uuid7(),
            "organization_id": organization_id,
            "user_id": user_id,
            "kind": kind,
            "title": _cut(title, _TITLE_MAX),
            "body": _cut(body, _BODY_MAX) if body else None,
            "link": link,
            "created_at": now,
        }
        for user_id in dict.fromkeys(recipients)
        if user_id != actor_id
    ]
    if rows:
        session.execute(insert(Notification), rows)
    return len(rows)


def inbox(session: Session, principal: Principal) -> Inbox:
    """Los avisos más recientes de la persona y cuántos no ha leído."""
    mine = (Notification.user_id == principal.user_id) & (
        Notification.organization_id == principal.organization_id
    )
    items = list(
        session.scalars(
            select(Notification)
            .where(mine)
            .order_by(Notification.created_at.desc(), Notification.id.desc())
            .limit(PAGE_SIZE)
        )
    )
    unread = session.scalar(select(func.count()).where(mine, Notification.read_at.is_(None)))
    return Inbox(items=items, unread=unread or 0)


def mark_read(session: Session, principal: Principal, notification_id: uuid.UUID) -> None:
    """Marca un aviso como leído. Repetirlo no cambia nada."""
    found = session.scalar(
        select(Notification.id).where(
            Notification.id == notification_id,
            Notification.user_id == principal.user_id,
            Notification.organization_id == principal.organization_id,
        )
    )
    if found is None:
        raise NotificationNotFoundError
    session.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.read_at.is_(None))
        .values(read_at=func.now())
    )
    session.commit()


def mark_all_read(session: Session, principal: Principal) -> int:
    """Marca como leídos todos los avisos pendientes de la persona."""
    result = session.execute(
        update(Notification)
        .where(
            Notification.user_id == principal.user_id,
            Notification.organization_id == principal.organization_id,
            Notification.read_at.is_(None),
        )
        .values(read_at=func.now())
    )
    session.commit()
    return int(getattr(result, "rowcount", 0) or 0)


def purge_old(session: Session) -> int:
    """Borra los avisos leídos hace más de 90 días y los de más de un año. Lo ejecuta el
    trabajador, sin despacho, con una función del dueño del esquema (migración 0069)."""
    return int(session.scalar(select(func.purge_old_notifications())) or 0)
