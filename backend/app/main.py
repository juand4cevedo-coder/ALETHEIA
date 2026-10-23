"""Punto de entrada de la API: uvicorn la construye con app.main:create_app --factory."""

from fastapi import FastAPI

from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logs import configure_logging
from app.core.middleware import RequestContextMiddleware

API_PREFIX = "/api/v1"


def create_app(settings: Settings | None = None) -> FastAPI:
    """Construye la aplicación; sin configuración válida no arranca."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="ALETHEIA API",
        version="0.1.0",
        # Bajo el prefijo de la API: Caddy envía /api a FastAPI y el resto a la interfaz.
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=f"{API_PREFIX}/docs",
        redoc_url=None,
    )
    register_exception_handlers(app)
    app.add_middleware(RequestContextMiddleware)
    return app
