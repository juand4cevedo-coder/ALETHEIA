"""Pruebas del formato Problem Details en las respuestas de error."""

from collections.abc import Iterator

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import PROBLEM_JSON
from app.main import create_app


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    app: FastAPI = create_app(settings)

    @app.get("/prueba/conflicto")
    def conflicto() -> None:
        raise HTTPException(status_code=409, detail="El caso ya existe.")

    @app.get("/prueba/numero")
    def numero(valor: int) -> int:
        return valor

    @app.get("/prueba/falla")
    def falla() -> None:
        msg = "detalle interno que no debe salir"
        raise RuntimeError(msg)

    # Sin relanzar la excepción: la prueba revisa lo que recibe el cliente.
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


def test_ruta_inexistente_responde_problem_details(client: TestClient) -> None:
    response = client.get("/no-existe")

    assert response.status_code == 404
    assert response.headers["content-type"] == PROBLEM_JSON
    assert response.json() == {
        "type": "about:blank",
        "title": "Not Found",
        "status": 404,
        "instance": "/no-existe",
    }


def test_http_exception_conserva_el_detalle(client: TestClient) -> None:
    response = client.get("/prueba/conflicto")

    assert response.status_code == 409
    assert response.json()["detail"] == "El caso ya existe."


def test_metodo_no_permitido_conserva_allow(client: TestClient) -> None:
    response = client.post("/prueba/conflicto")

    assert response.status_code == 405
    assert response.headers["allow"] == "GET"
    assert response.headers["content-type"] == PROBLEM_JSON


def test_validacion_no_devuelve_el_valor_recibido(client: TestClient) -> None:
    response = client.get("/prueba/numero", params={"valor": "dato-sensible"})

    assert response.status_code == 422
    assert response.headers["content-type"] == PROBLEM_JSON
    body = response.json()
    assert body["errors"][0]["loc"] == ["query", "valor"]
    assert "dato-sensible" not in response.text


def test_error_inesperado_no_expone_la_traza(client: TestClient) -> None:
    response = client.get("/prueba/falla")

    assert response.status_code == 500
    assert response.headers["content-type"] == PROBLEM_JSON
    assert response.json()["detail"] == "Ocurrió un error inesperado."
    assert "detalle interno" not in response.text
    assert "Traceback" not in response.text
