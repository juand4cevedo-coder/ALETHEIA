"""Medidas de rendimiento reales de quienes aceptaron la analítica (ADR-052).

La interfaz solo envía estas medidas si la persona aceptó la categoría «analítica» del panel de
cookies. Aquí se guardan sin ningún identificador y se resumen por versión, dispositivo y métrica
con el percentil 75, que es el que Google usa para valorar Core Web Vitals.
"""

import datetime
from dataclasses import dataclass
from typing import Final

from sqlalchemy import case, delete, func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.models import WebVital
from app.schemas.web_vitals import VitalsReport

RETENTION: Final = datetime.timedelta(days=90)

# Umbrales publicados de Core Web Vitals: hasta el primero es «bueno»; pasado el segundo, «malo».
# LCP, INP, FCP y TTFB en milisegundos; CLS sin unidad.
THRESHOLDS: Final[dict[str, tuple[float, float]]] = {
    "LCP": (2500, 4000),
    "INP": (200, 500),
    "CLS": (0.1, 0.25),
    "FCP": (1800, 3000),
    "TTFB": (800, 1800),
}


def rate(metric: str, value: float) -> str:
    good, poor = THRESHOLDS[metric]
    if value <= good:
        return "good"
    return "needs-improvement" if value <= poor else "poor"


def record(session: Session, version: str, report: VitalsReport) -> int:
    """Guarda una medida por métrica de la visita; si una se repite, solo cuenta la primera."""
    seen: set[str] = set()
    for item in report.metrics:
        if item.name in seen:
            continue
        seen.add(item.name)
        session.add(
            WebVital(
                metric=item.name,
                value=item.value,
                page=report.page,
                device=report.device,
                connection=report.connection,
                version=version,
            )
        )
    session.flush()
    return len(seen)


@dataclass(frozen=True, slots=True)
class SummaryRow:
    version: str
    device: str
    metric: str
    samples: int
    p75: float
    good_share: float
    rating: str


def _good_case() -> ColumnElement[int]:
    return case(
        *[
            (WebVital.metric == metric, case((WebVital.value <= good, 1), else_=0))
            for metric, (good, _poor) in THRESHOLDS.items()
        ],
        else_=0,
    )


def summary(session: Session, days: int) -> tuple[int, list[SummaryRow]]:
    """Total de medidas de los últimos días y el resumen por versión, dispositivo y métrica."""
    since = func.now() - datetime.timedelta(days=days)
    total = session.scalar(
        select(func.count()).select_from(WebVital).where(WebVital.created_at > since)
    )
    rows = session.execute(
        select(
            WebVital.version,
            WebVital.device,
            WebVital.metric,
            func.count(),
            func.percentile_cont(0.75).within_group(WebVital.value),
            func.avg(_good_case()),
        )
        .where(WebVital.created_at > since)
        .group_by(WebVital.version, WebVital.device, WebVital.metric)
        .order_by(WebVital.version.desc(), WebVital.device, WebVital.metric)
    ).all()
    result = [
        SummaryRow(
            version=version,
            device=device,
            metric=metric,
            samples=samples,
            p75=float(p75),
            good_share=float(good_share),
            rating=rate(metric, float(p75)),
        )
        for version, device, metric, samples, p75, good_share in rows
    ]
    return total or 0, result


def purge_expired(session: Session) -> int:
    """Borra las medidas con más de 90 días. Lo ejecuta el trabajador."""
    deleted = session.scalars(
        delete(WebVital).where(WebVital.created_at < func.now() - RETENTION).returning(WebVital.id)
    ).all()
    return len(deleted)
