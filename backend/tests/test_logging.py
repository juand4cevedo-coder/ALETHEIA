"""Pruebas de los registros estructurados y del identificador de petición."""

import json
import logging
from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.logs import JsonFormatter, request_id_var
from app.core.middleware import REQUEST_ID_HEADER
from app.main import create_app


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    app: FastAPI = create_app(settings)

    @app.get("/prueba/eco")
    def eco() -> dict[str, str]:
        return {"ok": "sí"}

    @app.get("/prueba/falla")
    def falla() -> None:
        msg = "falla de prueba"
        raise RuntimeError(msg)

    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


_LOGGER = "app.core.middleware"


def _registros(caplog: pytest.LogCaptureFixture, mensaje: str) -> list[logging.LogRecord]:
    return [r for r in caplog.records if r.name == _LOGGER and r.getMessage() == mensaje]


def _registro_de_peticion(caplog: pytest.LogCaptureFixture) -> logging.LogRecord:
    registros = _registros(caplog, "Petición atendida")
    assert len(registros) == 1
    return registros[0]


def test_cada_respuesta_lleva_un_identificador(client: TestClient) -> None:
    response = client.get("/prueba/eco")

    assert len(response.headers[REQUEST_ID_HEADER]) == 36


def test_conserva_un_identificador_valido_recibido(client: TestClient) -> None:
    response = client.get("/prueba/eco", headers={REQUEST_ID_HEADER: "caddy-1234abcd"})

    assert response.headers[REQUEST_ID_HEADER] == "caddy-1234abcd"


def test_reemplaza_un_identificador_invalido(client: TestClient) -> None:
    response = client.get("/prueba/eco", headers={REQUEST_ID_HEADER: "x\ninyectado"})

    assert response.headers[REQUEST_ID_HEADER] != "x\ninyectado"


def test_registra_la_peticion_sin_la_consulta(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger=_LOGGER):
        response = client.get("/prueba/eco", params={"correo": "abogada@ejemplo.co"})

    registro = _registro_de_peticion(caplog)
    assert registro.__dict__["method"] == "GET"
    assert registro.__dict__["path"] == "/prueba/eco"
    assert registro.__dict__["status"] == 200
    assert registro.__dict__["duration_ms"] >= 0
    linea = JsonFormatter().format(registro)
    assert "abogada@ejemplo.co" not in linea
    assert response.status_code == 200


def test_registra_el_error_inesperado_como_500(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger=_LOGGER):
        response = client.get("/prueba/falla")

    assert response.status_code == 500
    assert _registro_de_peticion(caplog).__dict__["status"] == 500
    (error,) = _registros(caplog, "Error inesperado")
    linea = json.loads(JsonFormatter().format(error))
    assert "RuntimeError: falla de prueba" in linea["exception"]


def test_formatter_produce_json_con_el_identificador() -> None:
    registro = logging.LogRecord("prueba", logging.INFO, __file__, 1, "Hola %s", ("mundo",), None)
    registro.__dict__["status"] = 201
    registro.__dict__["no_permitido"] = "secreto"
    token = request_id_var.set("caddy-1234abcd")
    try:
        entrada = json.loads(JsonFormatter().format(registro))
    finally:
        request_id_var.reset(token)

    assert entrada["message"] == "Hola mundo"
    assert entrada["level"] == "INFO"
    assert entrada["request_id"] == "caddy-1234abcd"
    assert entrada["status"] == 201
    assert "no_permitido" not in entrada
