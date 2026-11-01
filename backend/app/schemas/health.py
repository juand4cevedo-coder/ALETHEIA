"""Esquemas del endpoint de salud."""

from typing import Literal

from pydantic import BaseModel


class HealthStatus(BaseModel):
    """Estado del servicio y de la base de datos cuando ambos responden."""

    status: Literal["ok"]
    database: Literal["ok"]
