"""Middleware que identifica cada petición y deja un registro de su resultado."""

import logging
import re
import time
from typing import Final
from uuid import uuid7

from starlette.datastructures import Headers, MutableHeaders
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import unexpected_error_response
from app.core.logs import request_id_var

REQUEST_ID_HEADER: Final = "X-Request-ID"
# Un identificador externo solo se acepta si es corto y sin caracteres raros,
# para que nadie pueda inyectar texto en los registros.
_VALID_REQUEST_ID: Final = re.compile(r"[A-Za-z0-9-]{8,64}")

logger = logging.getLogger(__name__)


class RequestContextMiddleware:
    """Asigna un identificador a cada petición HTTP, registra método, ruta, estado y
    duración, y convierte un error inesperado en un 500 con su request_id."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _request_id_from(scope)
        token = request_id_var.set(request_id)
        status = 500
        response_started = False
        started = time.perf_counter()

        async def send_with_request_id(message: Message) -> None:
            nonlocal status, response_started
            if message["type"] == "http.response.start":
                status = message["status"]
                response_started = True
                MutableHeaders(scope=message).append(REQUEST_ID_HEADER, request_id)
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            # Si la respuesta ya empezó no se puede reemplazar: el servidor corta la conexión.
            if response_started:
                raise
            logger.exception("Error inesperado")
            response = unexpected_error_response(Request(scope))
            await response(scope, receive, send_with_request_id)
        finally:
            # La ruta va sin la cadena de consulta: puede llevar datos personales.
            logger.info(
                "Petición atendida",
                extra={
                    "method": scope["method"],
                    "path": scope["path"],
                    "status": status,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )
            request_id_var.reset(token)


def _request_id_from(scope: Scope) -> str:
    candidate = Headers(scope=scope).get(REQUEST_ID_HEADER)
    if candidate is not None and _VALID_REQUEST_ID.fullmatch(candidate):
        return candidate
    return str(uuid7())
