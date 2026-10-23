"""Respuestas de error en formato Problem Details (RFC 9457) para toda la API."""

from collections.abc import Mapping
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

PROBLEM_JSON = "application/problem+json"


def problem_response(
    request: Request,
    status: int,
    *,
    detail: str | None = None,
    headers: Mapping[str, str] | None = None,
    extensions: dict[str, Any] | None = None,
) -> JSONResponse:
    """Construye una respuesta application/problem+json con los miembros estándar."""
    body: dict[str, Any] = {
        # about:blank indica que el código HTTP basta para entender el problema.
        "type": "about:blank",
        "title": HTTPStatus(status).phrase,
        "status": status,
        "instance": request.url.path,
    }
    if detail is not None:
        body["detail"] = detail
    if extensions:
        body.update(extensions)
    return JSONResponse(body, status_code=status, headers=headers, media_type=PROBLEM_JSON)


async def _http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, StarletteHTTPException):  # Lo garantiza el registro de abajo.
        raise TypeError(type(exc).__name__)
    title = HTTPStatus(exc.status_code).phrase
    detail = exc.detail if isinstance(exc.detail, str) and exc.detail != title else None
    # Se conservan cabeceras como Allow (405) o WWW-Authenticate (401).
    return problem_response(request, exc.status_code, detail=detail, headers=exc.headers)


async def _validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):  # Lo garantiza el registro de abajo.
        raise TypeError(type(exc).__name__)
    # Solo ubicación, mensaje y tipo: el valor recibido no se devuelve, puede ser sensible.
    errors = [
        {"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]}
        for error in exc.errors()
    ]
    return problem_response(
        request,
        HTTPStatus.UNPROCESSABLE_CONTENT,
        detail="La solicitud tiene datos inválidos.",
        extensions={"errors": errors},
    )


async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # El servidor registra la traza completa; el cliente nunca la recibe.
    return problem_response(
        request,
        HTTPStatus.INTERNAL_SERVER_ERROR,
        detail="Ocurrió un error inesperado.",
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Hace que todo error de la API responda en formato Problem Details."""
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)
    app.add_exception_handler(RequestValidationError, _validation_exception_handler)
    app.add_exception_handler(Exception, _unhandled_exception_handler)
