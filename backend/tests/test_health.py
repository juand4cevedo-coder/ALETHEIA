"""Pruebas del endpoint de salud (API-001)."""

from collections.abc import Callable

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import PROBLEM_JSON
from app.core.middleware import REQUEST_ID_HEADER
from app.main import create_app

# Puerto 1 en la propia máquina: nada escucha ahí, así que la conexión se rechaza.
_UNREACHABLE_DATABASE = "postgresql+psycopg://aletheia:sin-uso@127.0.0.1:1/aletheia"


def test_responde_200_con_la_base_disponible(
    make_settings: Callable[[str], Settings], test_database_url: str
) -> None:
    with TestClient(create_app(make_settings(test_database_url))) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}
    assert response.headers["cache-control"] == "no-store"


def test_responde_503_en_problem_details_sin_base(make_settings: Callable[[str], Settings]) -> None:
    with TestClient(create_app(make_settings(_UNREACHABLE_DATABASE))) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 503
    assert response.headers["content-type"] == PROBLEM_JSON
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert body["detail"] == "La base de datos no responde."
    assert body["request_id"] == response.headers[REQUEST_ID_HEADER]
    assert "sin-uso" not in response.text
