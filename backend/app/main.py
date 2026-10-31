"""Punto de entrada de la API: uvicorn la construye con app.main:create_app --factory."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import health
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logs import configure_logging
from app.core.middleware import RequestContextMiddleware
from app.db.session import create_db_engine

API_PREFIX = "/api/v1"


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    # Al apagar, cierra las conexiones abiertas del pool.
    app.state.engine.dispose()


def create_app(settings: Settings | None = None) -> FastAPI:
    """Construye la aplicación; sin configuración válida no arranca."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    # En producción no se publican el contrato ni la documentación interactiva: muestran toda
    # la superficie de la API a cualquiera, y Swagger UI carga scripts de terceros que la CSP
    # de Caddy bloquea. En desarrollo siguen disponibles.
    public_docs = settings.environment != "production"
    app = FastAPI(
        title="ALETHEIA API",
        version="0.1.0",
        # Bajo el prefijo de la API: Caddy envía /api a FastAPI y el resto a la interfaz.
        openapi_url=f"{API_PREFIX}/openapi.json" if public_docs else None,
        docs_url=f"{API_PREFIX}/docs" if public_docs else None,
        redoc_url=None,
        lifespan=_lifespan,
    )
    app.state.engine = create_db_engine(settings)
    register_exception_handlers(app)
    app.add_middleware(RequestContextMiddleware)
    app.include_router(health.router, prefix=API_PREFIX)
    return app
