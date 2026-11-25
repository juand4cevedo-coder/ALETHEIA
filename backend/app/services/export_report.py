"""Informe legible del paquete de preservación, basado en el manifiesto exacto."""

import hashlib
import io
import json
from importlib.resources import files
from typing import Any

from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from app.services.export_manifest import FORMAT, FORMAT_VERSION, SCOPE, BuiltManifest

FONT = "AletheiaVera"
FONT_BOLD = "AletheiaVeraBold"
# El comprobador público y la guía del sello viven en el sitio de producción: quien recibe el
# paquete no tiene por qué conocer otro entorno.
VERIFIER_URL = "https://aletheia.sbs/verificador"
STAMP_GUIDE_URL = "https://aletheia.sbs/docs/revisar-un-sello-de-tiempo"


def _register_fonts() -> None:
    root = files("reportlab").joinpath("fonts")
    if FONT not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(FONT, str(root.joinpath("Vera.ttf"))))
        pdfmetrics.registerFont(TTFont(FONT_BOLD, str(root.joinpath("VeraBd.ttf"))))


def render_report(manifest: BuiltManifest) -> bytes:
    """Genera un PDF de una página con el alcance y las limitaciones de la comparación."""
    if hashlib.sha256(manifest.content).digest() != manifest.sha256:
        raise ValueError("La huella del manifiesto no coincide con sus bytes.")
    _register_fonts()
    document: dict[str, Any] = json.loads(manifest.content)
    if (
        document.get("format") != FORMAT
        or document.get("format_version") != FORMAT_VERSION
        or document.get("scope") != SCOPE
    ):
        raise ValueError("Formato de manifiesto desconocido.")
    evidences: list[dict[str, Any]] = document["evidences"]
    statuses = [row["tsa_status"] for row in evidences]
    anchor = document["custody"]["anchor_token_path"] is not None

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4, invariant=1, pageCompression=0)
    pdf.setTitle("Informe de preservación ALETHEIA")
    pdf.setAuthor("ALETHEIA")
    width, height = A4
    x = 48
    y = height - 56

    def line(text: str, *, font: str = FONT, size: int = 10, gap: int = 16) -> None:
        nonlocal y
        pdf.setFont(font, size)
        for segment in simpleSplit(text, font, size, width - 2 * x):
            pdf.drawString(x, y, segment)
            y -= gap

    line("ALETHEIA", font=FONT_BOLD, size=12, gap=24)
    line("Informe de preservación", font=FONT_BOLD, size=18, gap=30)
    line(f"Paquete: {document['export_id']}")
    line(f"Caso: {document['case_id']}")
    line(f"Generado (UTC): {document['generated_at']}")
    y -= 12
    line("Integridad del paquete", font=FONT_BOLD, size=12, gap=22)
    line(f"Evidencias incluidas: {len(evidences)}")
    line(f"Sellos obtenidos: {statuses.count('stamped')}")
    line(f"Sellos pendientes: {statuses.count('pending')}")
    line(f"Sellos fallidos: {statuses.count('failed')}")
    line(f"Cadena de custodia: {document['custody']['head_seq']} eventos verificados")
    line(f"Anclaje externo de la cabeza: {'incluido' if anchor else 'no disponible'}")
    y -= 12
    line("Huella SHA-256 de manifest.json", font=FONT_BOLD, size=12, gap=22)
    line(manifest.sha256.hex(), font="Courier", size=9)
    y -= 12
    line("Declaración de alcance", font=FONT_BOLD, size=12, gap=22)
    line("Este paquete permite comparar el SHA-256 de cada archivo con el manifiesto.")
    line("Una coincidencia no autentica el archivo ni el manifiesto y no demuestra su procedencia.")
    line("ALETHEIA no certifica el contenido ni determina admisibilidad o valor probatorio.")
    if not anchor:
        line(
            "Sin anclaje externo, la cadena no protege frente a una reescritura completa "
            "por quien controle la base de datos."
        )
    y -= 12
    line("Cómo comprobarlo sin ALETHEIA", font=FONT_BOLD, size=12, gap=22)
    line(
        f"1. Abra {VERIFIER_URL}, elija manifest.json y el archivo de files/ que quiere "
        "revisar. La huella se calcula en el navegador y el archivo no se envía a ninguna parte."
    )
    line(
        "2. Para revisar el sello de tiempo de un archivo con OpenSSL, use su .tsr de "
        "timestamps/, que lleva el mismo identificador:"
    )
    line(
        "openssl ts -verify -data files/<id> -in timestamps/<id>.tsr -CAfile <certificados raíz>",
        font="Courier",
        size=8,
    )
    line(f"Guía paso a paso: {STAMP_GUIDE_URL}")
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
