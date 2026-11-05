"""Middleware de la API: identifica cada petición y registra su resultado, y rechaza las
peticiones que cambian algo si no salen de la propia interfaz de ALETHEIA."""

import logging
import re
import time
from collections.abc import Collection
from http import HTTPStatus
from typing import Final
from uuid import uuid7

from starlette.datastructures import Headers, MutableHeaders
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import problem_response, unexpected_error_response
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


# Encabezado propio que la interfaz envía en toda petición que cambia algo (sección 9 de la
# especificación). Un formulario de otro sitio no puede ponerlo, y un script de otro sitio solo
# podría con un permiso de CORS que la API nunca da.
SAME_ORIGIN_HEADER: Final = "X-Aletheia-Request"
_SAME_ORIGIN_VALUE: Final = "1"
_UNSAFE_METHODS: Final = frozenset({"POST", "PUT", "PATCH", "DELETE"})
# Sec-Fetch-Site lo pone el navegador y ninguna página lo puede cambiar. none es una petición
# que la persona escribió o abrió ella misma, no una que un sitio le hizo hacer.
_ALLOWED_FETCH_SITES: Final = frozenset({"same-origin", "none"})
_FOREIGN_REQUEST: Final = (
    "La solicitud no salió de ALETHEIA. Recargue la página e inténtelo de nuevo."
)


class SameOriginMiddleware:
    """Protección contra CSRF para las rutas de la API que cambian algo.

    SameSite=Strict ya impide que la cookie viaje desde otro sitio. Esto agrega dos barreras
    más: el encabezado propio y, cuando el navegador los envía, Origin y Sec-Fetch-Site deben
    ser los del propio sitio. Un cliente que no es un navegador, como curl, no lleva cookies de
    nadie: solo necesita el encabezado.
    """

    def __init__(self, app: ASGIApp, *, allowed_origins: Collection[str], path_prefix: str) -> None:
        self.app = app
        self.allowed_origins = frozenset(allowed_origins)
        self.path_prefix = path_prefix

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] == "http"
            and scope["method"] in _UNSAFE_METHODS
            and scope["path"].startswith(self.path_prefix)
            and not self._comes_from_the_site(Headers(scope=scope))
        ):
            response = problem_response(
                Request(scope),
                HTTPStatus.FORBIDDEN,
                detail=_FOREIGN_REQUEST,
                headers={"Cache-Control": "no-store"},
            )
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)

    def _comes_from_the_site(self, headers: Headers) -> bool:
        if headers.get(SAME_ORIGIN_HEADER) != _SAME_ORIGIN_VALUE:
            return False
        origin = headers.get("origin")
        if origin is not None and origin not in self.allowed_origins:
            return False
        fetch_site = headers.get("sec-fetch-site")
        return fetch_site is None or fetch_site in _ALLOWED_FETCH_SITES
