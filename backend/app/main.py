"""Punto de entrada de la API: uvicorn la construye con app.main:create_app --factory."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Final

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from app.api import API_PREFIX, auth, health, invitations, me, organization, plans
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logs import configure_logging
from app.core.middleware import (
    REQUEST_ID_HEADER,
    SAME_ORIGIN_HEADER,
    RequestContextMiddleware,
    SameOriginMiddleware,
)
from app.core.openapi import install_problem_details
from app.db.session import create_db_engine

API_VERSION: Final = "0.2.0"


def _operation_id(route: APIRoute) -> str:
    """El nombre de la función de la ruta: el cliente del frontend la expone con ese nombre
    (health en lugar de health_api_v1_health_get). FastAPI avisa si dos rutas lo repiten."""
    return route.name


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    # Al apagar, cierra las conexiones abiertas del pool.
    app.state.engine.dispose()


def build_api(*, public_docs: bool) -> FastAPI:
    """Rutas, errores y contrato, sin configuración ni base de datos.

    Es lo único que necesita app.contract para exportar el OpenAPI, así que el contrato se
    genera igual en cualquier equipo y en la CI, sin variables de entorno.
    """
    # En producción no se publican el contrato ni la documentación interactiva: muestran toda
    # la superficie de la API a cualquiera, y Swagger UI carga scripts de terceros que la CSP
    # de Caddy bloquea. En desarrollo siguen disponibles.
    app = FastAPI(
        title="ALETHEIA API",
        version=API_VERSION,
        # Bajo el prefijo de la API: Caddy envía /api a FastAPI y el resto a la interfaz.
        openapi_url=f"{API_PREFIX}/openapi.json" if public_docs else None,
        docs_url=f"{API_PREFIX}/docs" if public_docs else None,
        redoc_url=None,
        generate_unique_id_function=_operation_id,
        lifespan=_lifespan,
    )
    register_exception_handlers(app)
    app.include_router(health.router, prefix=API_PREFIX)
    app.include_router(plans.router, prefix=API_PREFIX)
    app.include_router(auth.router, prefix=API_PREFIX)
    app.include_router(me.router, prefix=API_PREFIX)
    app.include_router(organization.router, prefix=API_PREFIX)
    app.include_router(invitations.router, prefix=API_PREFIX)
    install_problem_details(app)
    return app


def create_app(settings: Settings | None = None) -> FastAPI:
    """Construye la aplicación; sin configuración válida no arranca."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    app = build_api(public_docs=settings.environment != "production")
    app.state.engine = create_db_engine(settings)
    # La configuración con que se armó esta aplicación: las rutas la leen de aquí y no de
    # get_settings(), así una prueba o un despliegue usan siempre la que pasaron.
    app.state.settings = settings
    # Starlette ejecuta primero el último middleware agregado. El orden de afuera hacia
    # adentro queda así: identificar la petición, CORS y después la protección contra CSRF.
    # La interfaz y la API comparten origen, así que el único origen permitido es el del sitio.
    allowed_origins = [settings.public_url]
    app.add_middleware(
        SameOriginMiddleware, allowed_origins=allowed_origins, path_prefix=API_PREFIX
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", SAME_ORIGIN_HEADER, REQUEST_ID_HEADER],
        expose_headers=[REQUEST_ID_HEADER, "Retry-After"],
        max_age=600,
    )
    app.add_middleware(RequestContextMiddleware)
    return app
