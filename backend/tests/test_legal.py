"""La versión legal del backend debe ser la que muestra el frontend (RN-029)."""

import re
from pathlib import Path

from app.core.legal import LEGAL_VERSION

_FRONTEND_LEGAL = Path(__file__).resolve().parents[2] / "frontend" / "src" / "config" / "legal.ts"


def test_la_version_legal_es_la_misma_en_backend_y_frontend() -> None:
    match = re.search(
        r'^export const LEGAL_VERSION = "([^"]+)";$',
        _FRONTEND_LEGAL.read_text(encoding="utf-8"),
        re.MULTILINE,
    )
    assert match is not None, f"No encontré LEGAL_VERSION en {_FRONTEND_LEGAL}"
    assert match.group(1) == LEGAL_VERSION
