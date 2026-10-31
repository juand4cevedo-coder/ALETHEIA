"""Exporta el contrato OpenAPI de la API a backend/openapi.json.

Uso, desde backend/:  uv run python -m app.contract

El frontend genera sus tipos desde ese archivo, y la prueba tests/test_contract.py falla si
el archivo guardado no coincide con lo que la API publica hoy.
"""

import json
from pathlib import Path
from typing import Final

from app.main import build_api

CONTRACT_PATH: Final = Path(__file__).resolve().parents[1] / "openapi.json"


def render_contract() -> str:
    """El contrato como texto JSON estable: misma API, mismo archivo, byte por byte."""
    schema = build_api(public_docs=True).openapi()
    # ensure_ascii=False deja las tildes legibles en las descripciones.
    return json.dumps(schema, indent=2, ensure_ascii=False) + "\n"


def main() -> None:
    CONTRACT_PATH.write_text(render_contract(), encoding="utf-8", newline="\n")
    print(f"Contrato escrito en {CONTRACT_PATH}")


if __name__ == "__main__":
    main()
