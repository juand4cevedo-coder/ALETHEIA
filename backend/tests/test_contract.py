"""Pruebas del contrato OpenAPI que comparten la API y el frontend."""

import tomllib
from pathlib import Path
from typing import Any

from fastapi import FastAPI

from app.contract import CONTRACT_PATH, render_contract
from app.core.errors import PROBLEM_JSON
from app.main import build_api

_PYPROJECT = Path(__file__).resolve().parents[1] / "pyproject.toml"


def _schema_ref(response: dict[str, Any]) -> str:
    ref: str = response["content"][PROBLEM_JSON]["schema"]["$ref"]
    return ref


def test_el_contrato_guardado_esta_al_dia() -> None:
    # Si falla: la API cambió y falta regenerar el contrato y los tipos del frontend.
    # Desde backend/:  uv run python -m app.contract
    # Desde frontend/: pnpm api:generate
    assert CONTRACT_PATH.read_text(encoding="utf-8") == render_contract()


def test_la_version_del_contrato_es_la_del_proyecto() -> None:
    with _PYPROJECT.open("rb") as archivo:
        version = tomllib.load(archivo)["project"]["version"]

    assert build_api(public_docs=True).openapi()["info"]["version"] == version


def test_cada_operacion_se_identifica_con_el_nombre_de_su_funcion() -> None:
    operacion = build_api(public_docs=True).openapi()["paths"]["/api/v1/health"]["get"]

    assert operacion["operationId"] == "health"


def test_los_errores_declarados_son_problem_details() -> None:
    operacion = build_api(public_docs=True).openapi()["paths"]["/api/v1/health"]["get"]

    assert _schema_ref(operacion["responses"]["503"]) == "#/components/schemas/Problem"


def test_el_422_se_documenta_como_validation_problem() -> None:
    app: FastAPI = build_api(public_docs=True)

    @app.get("/prueba/numero")
    def numero(valor: int) -> int:
        return valor

    schema = app.openapi()
    respuesta = schema["paths"]["/prueba/numero"]["get"]["responses"]["422"]

    assert _schema_ref(respuesta) == "#/components/schemas/ValidationProblem"
    assert set(respuesta["content"]) == {PROBLEM_JSON}
    # Los esquemas de 422 propios de FastAPI no deben quedar en el contrato.
    assert "HTTPValidationError" not in schema["components"]["schemas"]
    assert "ValidationError" not in schema["components"]["schemas"]
