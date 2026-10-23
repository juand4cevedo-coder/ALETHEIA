"""Piezas compartidas por las pruebas del backend."""

import pytest

from app.core.config import Settings


@pytest.fixture
def settings() -> Settings:
    """Configuración de prueba que no lee el entorno ni un .env local."""
    return Settings.model_validate(
        {
            "environment": "test",
            "database_url": "postgresql+psycopg://aletheia:clave-de-prueba@localhost:5432/aletheia",
        }
    )
