"""Arranque del trabajador: python -m app.worker.

Con --check revisa el latido y termina con 0 si el trabajador está vivo: es la revisión de
salud del contenedor, que no tiene puerto que consultar. Esa ruta no importa nada pesado.
"""

import argparse
import sys
from collections.abc import Sequence

from app.worker import heartbeat


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.worker", description="Trabajador de tareas de ALETHEIA."
    )
    parser.add_argument(
        "--check", action="store_true", help="Revisa el latido y sale con 0 si está vivo."
    )
    if parser.parse_args(argv).check:
        return 0 if heartbeat.is_fresh(heartbeat.HEARTBEAT, heartbeat.MAX_AGE_SECONDS) else 1
    _run()
    return 0


def _run() -> None:
    import signal
    import threading

    from app.adapters.email import build_email_sender
    from app.core.config import get_settings
    from app.core.logs import configure_logging
    from app.db.session import create_db_engine
    from app.worker.handlers import WorkerContext
    from app.worker.runner import Worker

    settings = get_settings()
    configure_logging(settings.log_level)
    engine = create_db_engine(settings)
    stop = threading.Event()
    # Docker detiene el contenedor con SIGTERM; en la terminal se usa Ctrl+C.
    for signal_number in (signal.SIGTERM, signal.SIGINT):
        signal.signal(signal_number, lambda *_: stop.set())
    try:
        context = WorkerContext(email=build_email_sender(settings), settings=settings)
        Worker(engine, context, heartbeat=heartbeat.HEARTBEAT).run(stop)
    finally:
        engine.dispose()


if __name__ == "__main__":
    sys.exit(main())
