"""Pruebas de la documentación de la API según el entorno."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app

# El motor no se conecta al construir la aplicación: esta URL nunca se usa.
_URL = "postgresql+psycopg://aletheia_app@127.0.0.1:1/aletheia"
_RUTAS = ("/api/v1/openapi.json", "/api/v1/docs")


def _cliente(**valores: str) -> TestClient:
    # Cada campo va explícito: los valores directos tienen prioridad sobre el entorno y sobre
    # backend/.env, que en desarrollo trae log_level DEBUG.
    base = {"log_level": "INFO", "database_url": _URL}
    return TestClient(create_app(Settings.model_validate({**base, **valores})))


@pytest.mark.parametrize("ruta", _RUTAS)
def test_en_desarrollo_la_documentacion_esta_disponible(ruta: str) -> None:
    with _cliente(environment="development") as client:
        assert client.get(ruta).status_code == 200


@pytest.mark.parametrize("ruta", _RUTAS)
def test_en_produccion_la_documentacion_no_existe(ruta: str) -> None:
    produccion = _cliente(
        environment="production",
        database_password_parameter="/aletheia/prod/postgres/app-password",  # noqa: S106
    )
    with produccion as client:
        assert client.get(ruta).status_code == 404
