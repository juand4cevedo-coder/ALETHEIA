"""Piezas compartidas por las pruebas del backend."""

import os
from collections.abc import Callable

import pytest
from sqlalchemy import make_url

from app.core.config import Settings

TEST_DATABASE_URL_VARIABLE = "ALETHEIA_TEST_DATABASE_URL"


def _build_settings(database_url: str) -> Settings:
    # Cada campo se da explícito: los valores directos tienen prioridad sobre el entorno y
    # sobre backend/.env, así que la prueba no depende de la configuración del equipo.
    return Settings.model_validate(
        {"environment": "test", "log_level": "INFO", "database_url": database_url}
    )


@pytest.fixture
def make_settings() -> Callable[[str], Settings]:
    """Construye una configuración de prueba con la URL de base de datos indicada."""
    return _build_settings


@pytest.fixture
def settings() -> Settings:
    """Configuración con una URL que nunca se usa para conectar."""
    return _build_settings("postgresql+psycopg://aletheia:clave-de-prueba@localhost:5432/aletheia")


@pytest.fixture
def test_database_url() -> str:
    """URL de la base de pruebas real, con el controlador que exige la API."""
    url = os.environ.get(TEST_DATABASE_URL_VARIABLE)
    if not url:
        pytest.fail(f"Falta la variable {TEST_DATABASE_URL_VARIABLE} con la URL de la base.")
    # La prueba de humo usa psycopg directo; SQLAlchemy necesita el controlador explícito.
    return make_url(url).set(drivername="postgresql+psycopg").render_as_string(hide_password=False)
