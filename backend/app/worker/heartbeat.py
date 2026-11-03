"""Latido del trabajador: un archivo que se toca en cada vuelta del ciclo.

Solo usa la biblioteca estándar, porque la revisión de salud del contenedor lo importa cada
15 segundos y no debe cargar SQLAlchemy, boto3 ni la configuración para eso.
"""

import tempfile
import time
from pathlib import Path
from typing import Final

HEARTBEAT: Final = Path(tempfile.gettempdir()) / "aletheia-worker.heartbeat"
# Más que la tarea más larga de hoy: un envío a SES con sus tres reintentos.
MAX_AGE_SECONDS: Final = 120.0


def is_fresh(path: Path, max_age_seconds: float) -> bool:
    """Indica si el trabajador dio señales de vida hace menos de max_age_seconds."""
    try:
        age = time.time() - path.stat().st_mtime
    except FileNotFoundError:
        return False
    return age < max_age_seconds
