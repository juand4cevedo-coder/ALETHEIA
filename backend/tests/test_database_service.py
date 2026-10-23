"""Prueba de humo del servicio PostgreSQL que usan las pruebas del backend."""

import psycopg
from sqlalchemy import make_url


def test_postgresql_service_runs_major_version_18(test_database_url: str) -> None:
    # psycopg directo no entiende el sufijo +psycopg de SQLAlchemy: se quita aquí.
    url = make_url(test_database_url).set(drivername="postgresql")
    with psycopg.connect(url.render_as_string(hide_password=False), connect_timeout=5) as conn:
        server_version = conn.info.server_version

    assert 180000 <= server_version < 190000, f"PostgreSQL respondió la versión {server_version}"
