"""Operación: medidas de rendimiento reales de quienes aceptaron la analítica (ADR-052)."""

from typing import Final

from sqlalchemy import CheckConstraint, Index
from sqlalchemy.orm import Mapped

from app.db.base import Base
from app.models._columns import CreatedAt, UUIDv7Pk, text_values

WEB_VITAL_METRICS: Final = ("LCP", "INP", "CLS", "FCP", "TTFB")
# Grupos de página, no rutas: la interfaz nunca envía una dirección ni un identificador.
WEB_VITAL_PAGES: Final = (
    "inicio",
    "precios",
    "ingreso",
    "documentacion",
    "legal",
    "espacio",
    "otra",
)
WEB_VITAL_DEVICES: Final = ("movil", "escritorio")
WEB_VITAL_CONNECTIONS: Final = ("slow-2g", "2g", "3g", "4g")


class WebVital(Base):
    """Una medida de una visita (Core Web Vitals más FCP y TTFB).

    La fila no lleva cuenta, sesión, IP, navegador ni ningún identificador: solo la métrica, su
    valor, el grupo de página, el tipo de pantalla y de conexión, y la versión del sitio que se
    estaba sirviendo. Dos medidas de la misma visita no se pueden relacionar entre sí. Cada fila
    vive 90 días; después el trabajador la borra.
    """

    __tablename__ = "web_vitals"
    __table_args__ = (
        CheckConstraint(text_values("metric", WEB_VITAL_METRICS), name="metric"),
        CheckConstraint(text_values("page", WEB_VITAL_PAGES), name="page"),
        CheckConstraint(text_values("device", WEB_VITAL_DEVICES), name="device"),
        CheckConstraint(
            "connection IS NULL OR " + text_values("connection", WEB_VITAL_CONNECTIONS),
            name="connection",
        ),
        # Ningún valor negativo ni absurdo: el tope son diez minutos en milisegundos.
        CheckConstraint("value >= 0 AND value <= 600000", name="value_range"),
        CheckConstraint("version ~ '^[0-9]+\\.[0-9]+\\.[0-9]+$'", name="version_format"),
        # El resumen agrupa por versión, dispositivo y métrica dentro de una ventana de fechas.
        Index("ix_web_vitals_created_at_metric", "created_at", "metric"),
    )

    id: Mapped[UUIDv7Pk]
    created_at: Mapped[CreatedAt]
    metric: Mapped[str]
    value: Mapped[float]
    page: Mapped[str]
    device: Mapped[str]
    connection: Mapped[str | None]
    version: Mapped[str]
