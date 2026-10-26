"""Contexto de organización para Row-Level Security.

PostgreSQL filtra las filas de las tablas de una organización con dos valores que se fijan al
inicio de cada transacción: la organización y la persona que consultan. Se fijan con
set_config local, así que mueren con la transacción y nunca pasan a la siguiente petición que
use la misma conexión del pool. Una sesión sin contexto no ve filas: se niega por defecto.
"""

import uuid
from dataclasses import dataclass
from typing import Final

from sqlalchemy import Connection, event, text
from sqlalchemy.orm import Session, SessionTransaction

_INFO_KEY: Final = "aletheia_tenant"

_APPLY = text(
    "SELECT set_config('aletheia.organization_id', :organization_id, true), "
    "set_config('aletheia.user_id', :user_id, true)"
)


@dataclass(frozen=True, slots=True)
class TenantContext:
    """Quién consulta y en qué organización. Cualquiera de los dos puede faltar."""

    organization_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None


def set_tenant(session: Session, context: TenantContext) -> None:
    """Fija el contexto de la sesión para su transacción actual y las siguientes."""
    session.info[_INFO_KEY] = context
    if session.in_transaction():
        _apply(session.connection(), context)


def _apply(connection: Connection, context: TenantContext) -> None:
    # Vacío equivale a sin contexto: las funciones de la base lo convierten en NULL.
    connection.execute(
        _APPLY,
        {
            "organization_id": str(context.organization_id or ""),
            "user_id": str(context.user_id or ""),
        },
    )


@event.listens_for(Session, "after_begin")
def _apply_on_begin(
    session: Session, transaction: SessionTransaction, connection: Connection
) -> None:
    # Cada transacción nueva arranca con el contexto de su sesión, o sin ninguno.
    _apply(connection, session.info.get(_INFO_KEY, TenantContext()))
