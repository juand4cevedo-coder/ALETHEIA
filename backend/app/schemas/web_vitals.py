"""Esquemas de las medidas de rendimiento reales (ADR-052)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Metric = Literal["LCP", "INP", "CLS", "FCP", "TTFB"]
Page = Literal["inicio", "precios", "ingreso", "documentacion", "legal", "espacio", "otra"]
Device = Literal["movil", "escritorio"]
Connection = Literal["slow-2g", "2g", "3g", "4g"]


class VitalValue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Metric
    value: float = Field(
        ge=0,
        le=600_000,
        allow_inf_nan=False,
        description="Milisegundos; en CLS, el puntaje sin unidad.",
    )


class VitalsReport(BaseModel):
    """Lo que entrega una visita al terminar. Nada de esto identifica a una persona."""

    model_config = ConfigDict(extra="forbid")

    page: Page = Field(description="Grupo de la página medida, nunca su dirección.")
    device: Device = Field(description="Según el ancho de la pantalla.")
    connection: Connection | None = Field(
        default=None, description="Tipo efectivo de conexión, si el navegador lo informa."
    )
    metrics: list[VitalValue] = Field(
        min_length=1, max_length=5, description="Una medida por métrica, como máximo."
    )


class VitalSummaryRow(BaseModel):
    version: str
    device: Device
    metric: Metric
    samples: int = Field(description="Cuántas medidas entraron en el cálculo.")
    p75: float = Field(description="Percentil 75: lo que Google usa para valorar cada métrica.")
    good_share: float = Field(description="Parte de las medidas dentro del umbral bueno, de 0 a 1.")
    rating: Literal["good", "needs-improvement", "poor"] = Field(
        description="Valoración del p75 contra los umbrales de Core Web Vitals."
    )


class VitalsSummary(BaseModel):
    days: int
    total_samples: int
    rows: list[VitalSummaryRow]
