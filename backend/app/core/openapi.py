"""Contrato OpenAPI: describe los errores como Problem Details, igual que los responde la API."""

from collections.abc import Callable
from typing import Any, Final

from fastapi import FastAPI
from pydantic import TypeAdapter

from app.core.errors import PROBLEM_JSON
from app.schemas.errors import Problem, ValidationErrorItem, ValidationProblem

_SCHEMAS_REF: Final = "#/components/schemas/{model}"
# Esquemas que FastAPI agrega por defecto para el 422; la API nunca responde con esa forma.
_FASTAPI_VALIDATION_SCHEMAS: Final = ("HTTPValidationError", "ValidationError")
_VALIDATION_DESCRIPTION: Final = "La solicitud tiene datos inválidos."
_HTTP_METHODS: Final = frozenset({"get", "put", "post", "delete", "options", "head", "patch"})


def _problem_schemas() -> dict[str, Any]:
    """Esquemas JSON de Problem, ValidationProblem y ValidationErrorItem."""
    _, definitions = TypeAdapter.json_schemas(
        [
            ("Problem", "serialization", TypeAdapter(Problem)),
            ("ValidationProblem", "serialization", TypeAdapter(ValidationProblem)),
            ("ValidationErrorItem", "serialization", TypeAdapter(ValidationErrorItem)),
        ],
        ref_template=_SCHEMAS_REF,
    )
    schemas: dict[str, Any] = definitions["$defs"]
    return schemas


def _problem_content(model: str) -> dict[str, Any]:
    return {PROBLEM_JSON: {"schema": {"$ref": _SCHEMAS_REF.format(model=model)}}}


def with_problem_details(schema: dict[str, Any]) -> dict[str, Any]:
    """Toda respuesta 4xx o 5xx del contrato pasa a application/problem+json: los 422 con
    ValidationProblem y el resto con Problem. Quita los esquemas de 422 propios de FastAPI."""
    for path_item in schema.get("paths", {}).values():
        for method, operation in path_item.items():
            if method not in _HTTP_METHODS:
                continue
            for code, response in operation.get("responses", {}).items():
                if code == "422":
                    response["description"] = _VALIDATION_DESCRIPTION
                    response["content"] = _problem_content("ValidationProblem")
                elif code[0] in "45":
                    response["content"] = _problem_content("Problem")

    components = schema.setdefault("components", {}).setdefault("schemas", {})
    for name in _FASTAPI_VALIDATION_SCHEMAS:
        components.pop(name, None)
    components.update(_problem_schemas())
    # Mismo orden siempre: el archivo del contrato no cambia si nada cambió.
    schema["components"]["schemas"] = dict(sorted(components.items()))
    return schema


def install_problem_details(app: FastAPI) -> None:
    """Reemplaza app.openapi para que el contrato generado use Problem Details."""
    build: Callable[[], dict[str, Any]] = app.openapi

    def openapi() -> dict[str, Any]:
        if app.openapi_schema is None:
            app.openapi_schema = with_problem_details(build())
        return app.openapi_schema

    app.openapi = openapi  # type: ignore[method-assign]
