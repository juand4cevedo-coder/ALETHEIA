"""Rutas de la API, todas bajo el mismo prefijo versionado."""

from typing import Final

# Caddy envía /api a FastAPI y el resto a la interfaz (ADR-002).
API_PREFIX: Final = "/api/v1"
