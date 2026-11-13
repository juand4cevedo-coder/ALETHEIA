"""Pruebas del motor de base de datos de la aplicación."""

from collections.abc import Callable

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.config import Settings
from app.db.session import create_db_engine


def test_un_error_de_sql_no_repite_los_valores_de_la_consulta(
    make_settings: Callable[[str], Settings], test_database_url: str, migrated_database: None
) -> None:
    # El primer valor provoca el error; el segundo no tiene nada que ver con él y, sin
    # hide_parameters, aparecería igual en el mensaje que llega a los registros.
    engine = create_db_engine(make_settings(test_database_url))
    try:
        with engine.connect() as connection, pytest.raises(DBAPIError) as excinfo:
            connection.execute(
                text("SELECT 1 FROM plans WHERE id = :id AND name = :name"),
                {"id": "no-es-un-uuid", "name": "$argon2id$hash-que-no-debe-salir"},
            )
    finally:
        engine.dispose()

    assert "hash-que-no-debe-salir" not in str(excinfo.value)


def test_cada_sesion_tiene_limites_de_tiempo(
    make_settings: Callable[[str], Settings], test_database_url: str, migrated_database: None
) -> None:
    engine = create_db_engine(make_settings(test_database_url))
    try:
        with engine.connect() as connection:
            limits = {
                name: connection.execute(text(f"SHOW {name}")).scalar_one()
                for name in (
                    "statement_timeout",
                    "lock_timeout",
                    "idle_in_transaction_session_timeout",
                )
            }
    finally:
        engine.dispose()

    assert limits == {
        "statement_timeout": "30s",
        "lock_timeout": "10s",
        "idle_in_transaction_session_timeout": "1min",
    }
