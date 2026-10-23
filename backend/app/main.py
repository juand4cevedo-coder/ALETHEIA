"""Punto de entrada de la API: uvicorn sirve app.main:app."""

from fastapi import FastAPI

from app.core.errors import register_exception_handlers

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    """Construye la aplicación con su configuración común."""
    app = FastAPI(
        title="ALETHEIA API",
        version="0.1.0",
        # Bajo el prefijo de la API: Caddy envía /api a FastAPI y el resto a la interfaz.
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=f"{API_PREFIX}/docs",
        redoc_url=None,
    )
    register_exception_handlers(app)
    return app


app = create_app()
