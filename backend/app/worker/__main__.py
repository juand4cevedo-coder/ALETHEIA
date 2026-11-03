"""Arranque del trabajador: python -m app.worker.

Con --check revisa el latido y termina con 0 si el trabajador está vivo: es la revisión de
salud del contenedor, que no tiene puerto que consultar.
"""

import argparse
import signal
import sys
import tempfile
import threading
from collections.abc import Sequence
from pathlib import Path
from typing import Final

from app.adapters.email import build_email_sender
from app.core.config import get_settings
from app.core.logs import configure_logging
from app.db.session import create_db_engine
from app.worker.handlers import WorkerContext
from app.worker.runner import Worker, heartbeat_is_fresh

HEARTBEAT: Final = Path(tempfile.gettempdir()) / "aletheia-worker.heartbeat"
# Más que la tarea más larga de hoy: un envío a SES con sus tres reintentos.
HEARTBEAT_MAX_AGE: Final = 120.0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.worker", description="Trabajador de tareas de ALETHEIA."
    )
    parser.add_argument(
        "--check", action="store_true", help="Revisa el latido y sale con 0 si está vivo."
    )
    if parser.parse_args(argv).check:
        return 0 if heartbeat_is_fresh(HEARTBEAT, HEARTBEAT_MAX_AGE) else 1

    settings = get_settings()
    configure_logging(settings.log_level)
    engine = create_db_engine(settings)
    stop = threading.Event()
    # Docker detiene el contenedor con SIGTERM; en la terminal se usa Ctrl+C.
    for signal_number in (signal.SIGTERM, signal.SIGINT):
        signal.signal(signal_number, lambda *_: stop.set())
    try:
        context = WorkerContext(email=build_email_sender(settings))
        Worker(engine, context, heartbeat=HEARTBEAT).run(stop)
    finally:
        engine.dispose()
    return 0


if __name__ == "__main__":
    sys.exit(main())
