"""Prueba de humo del servicio PostgreSQL que usan las pruebas del backend."""

import os

import psycopg
import pytest

DATABASE_URL_VARIABLE = "ALETHEIA_TEST_DATABASE_URL"


def _database_url() -> str:
    url = os.environ.get(DATABASE_URL_VARIABLE)
    if not url:
        pytest.fail(f"Falta la variable {DATABASE_URL_VARIABLE} con la URL de la base de pruebas.")
    return url


def test_postgresql_service_runs_major_version_18() -> None:
    with psycopg.connect(_database_url(), connect_timeout=5) as connection:
        server_version = connection.info.server_version

    assert 180000 <= server_version < 190000, f"PostgreSQL respondió la versión {server_version}"
