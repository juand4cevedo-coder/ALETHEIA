"""Comprobante de pago de ALETHEIA en PDF, una página A4.

Lleva el formato de una factura profesional (quién emite, quién paga, detalle, totales y datos
del pago), pero se llama comprobante de pago: el vendedor es persona natural no responsable de
IVA y no expide factura electrónica, así que llamarlo factura sería inexacto.

El diseño sigue la identidad Tinta violeta (ADR-060): Geist para el texto, Newsreader para el
título y el total, Geist Mono para números y referencias, y el latón solo donde hay sello. La
marca, el emblema de fondo y el grabado se dibujan con trazos vectoriales a partir de la misma
geometría del sitio (frontend/src/brand/geometria.ts), sin imágenes, para que el archivo sea
liviano y nítido a cualquier escala. Las fuentes salen de app/assets/fonts (ver
scripts/fuentes_pdf.py).
"""

import datetime
import io
import math
import re
from collections.abc import Iterable
from pathlib import Path
from typing import Final
from zoneinfo import ZoneInfo

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from app.models import PaymentReceipt
from app.services.receipts import CYCLES, NOT_AN_INVOICE, cop, method_label

_BOGOTA: Final = ZoneInfo("America/Bogota")
_FONTS_DIR: Final = Path(__file__).resolve().parents[1] / "assets" / "fonts"

SANS: Final = "AletheiaGeist"
SANS_MEDIUM: Final = "AletheiaGeistMedium"
SANS_BOLD: Final = "AletheiaGeistSemiBold"
SERIF: Final = "AletheiaNewsreader"
SERIF_ITALIC: Final = "AletheiaNewsreaderItalic"
MONO: Final = "AletheiaGeistMono"
_FONT_FILES: Final = {
    SANS: "Geist-Regular.ttf",
    SANS_MEDIUM: "Geist-Medium.ttf",
    SANS_BOLD: "Geist-SemiBold.ttf",
    SERIF: "Newsreader-Display.ttf",
    SERIF_ITALIC: "Newsreader-Italic.ttf",
    MONO: "GeistMono-Regular.ttf",
}

# Quien vende: los mismos datos de los términos y condiciones (frontend/src/config/legal.ts).
SELLER_NAME: Final = "Juan Diego Acevedo Calderón"
SELLER_ID: Final = "NIT 1214744661-9"
SELLER_TAX: Final = "Persona natural no responsable de IVA"
SELLER_ADDRESS: Final = "Avenida 40 # 62-56, Bello, Antioquia, Colombia"
SELLER_EMAIL: Final = "contacto@aletheia.sbs"
SELLER_SITE: Final = "aletheia.sbs"

# Paleta Tinta violeta, versión impresa: el texto es casi negro con un punto de violeta, los grises
# son cálidos y todos los pares de texto pasan 4,5:1 sobre el papel y sobre el tinte.
INK: Final = HexColor("#55278a")
INK_DEEP: Final = HexColor("#3f1c69")
TEXT: Final = HexColor("#17131f")
MUTED: Final = HexColor("#5d566a")
HAIRLINE: Final = HexColor("#e4deec")
TINT: Final = HexColor("#f6f3fa")
WATERMARK: Final = HexColor("#f2eef8")
BRASS: Final = HexColor("#7a5a22")
BRASS_LIGHT: Final = HexColor("#d9b871")
OK: Final = HexColor("#1f6b4a")
OK_TINT: Final = HexColor("#e8f3ed")
ON_INK_2: Final = HexColor("#e6dcf3")

PAGE_W, PAGE_H = A4
MARGIN: Final = 52
CONTENT_W: Final = PAGE_W - 2 * MARGIN

# El logotipo de la marca: trazos rectos sobre 20 unidades de alto (Logotipo.tsx).
_LOGOTYPE: Final = (
    "M0 20L7.75 0L15.5 20M21.5 0V20H32M50.1 0H39.6V20H50.1M39.6 10H48.6M56.7 0H69.7M63.2 0V20"
    "M76.3 0V20M89.3 0V20M76.3 10H89.3M107 0H96.5V20H107M96.5 10H105.5M114.2 0V20"
    "M120.4 20L128.15 0L135.9 20"
)
_LOGOTYPE_W: Final = 135.9


def _register_fonts() -> None:
    registered = set(pdfmetrics.getRegisteredFontNames())
    for name, file in _FONT_FILES.items():
        if name not in registered:
            pdfmetrics.registerFont(TTFont(name, str(_FONTS_DIR / file)))


def _day(value: datetime.datetime) -> str:
    return value.astimezone(_BOGOTA).strftime("%d/%m/%Y")


_MONTHS: Final = (
    *("enero", "febrero", "marzo", "abril", "mayo", "junio"),
    *("julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"),
)


def _long_day(value: datetime.datetime) -> str:
    local = value.astimezone(_BOGOTA)
    return f"{local.day} de {_MONTHS[local.month - 1]} de {local.year}"


# Dibujo de la marca ---------------------------------------------------------------------------


def _eye(pdf: canvas.Canvas, cx: float, cy: float, width: float, height: float) -> None:
    """El ojo de la marca: dos párpados de curva cuadrática, en coordenadas del PDF (y hacia
    arriba). Cada cuadrática se escribe como la cúbica equivalente."""
    x0, x1 = cx - width / 2, cx + width / 2

    Point = tuple[float, float]

    def quad(start: Point, control: Point, end: Point) -> tuple[float, ...]:
        c1 = (
            start[0] + 2 / 3 * (control[0] - start[0]),
            start[1] + 2 / 3 * (control[1] - start[1]),
        )
        c2 = (end[0] + 2 / 3 * (control[0] - end[0]), end[1] + 2 / 3 * (control[1] - end[1]))
        return (*c1, *c2, *end)

    path = pdf.beginPath()
    path.moveTo(x0, cy)
    path.curveTo(*quad((x0, cy), (cx, cy + height), (x1, cy)))
    path.curveTo(*quad((x1, cy), (cx, cy - height), (x0, cy)))
    path.close()
    pdf.drawPath(path, stroke=1, fill=0)


def _symbol(pdf: canvas.Canvas, left: float, top: float, size: float) -> None:
    """El símbolo: recuadro de tinta, ojo blanco, iris y pupila de latón, en su cuadrícula de 64."""
    s = size / 64
    cx, cy = left + 32 * s, top - 32 * s
    pdf.setFillColor(INK)
    pdf.roundRect(left, top - size, size, size, 15 * s, stroke=0, fill=1)
    pdf.setStrokeColor(white)
    pdf.setLineJoin(1)
    pdf.setLineWidth(4 * s)
    _eye(pdf, cx, cy, 48 * s, 22 * s)
    pdf.setLineWidth(3.4 * s)
    pdf.circle(cx, cy, 9.4 * s, stroke=1, fill=0)
    pdf.setFillColor(BRASS_LIGHT)
    pdf.circle(cx, cy, 4.3 * s, stroke=0, fill=1)


def _logotype(pdf: canvas.Canvas, left: float, baseline: float, height: float) -> float:
    """El logotipo monolineal con las A como lambdas. Devuelve el ancho dibujado."""
    s = height / 20
    path = pdf.beginPath()
    x = y = 0.0
    for command, args in re.findall(r"([MLHV])([^MLHV]*)", _LOGOTYPE):
        values = [float(v) for v in args.split()]
        if command in "ML":
            x, y = values
        elif command == "H":
            x = values[0]
        else:
            y = values[0]
        point = (left + x * s, baseline + (20 - y) * s)
        if command == "M":
            path.moveTo(*point)
        else:
            path.lineTo(*point)
    pdf.setStrokeColor(INK)
    pdf.setLineWidth(3.1 * s)
    pdf.setLineJoin(0)
    pdf.setLineCap(2)
    pdf.drawPath(path, stroke=1, fill=0)
    pdf.setLineCap(0)
    return _LOGOTYPE_W * s


def _guilloche(
    pdf: canvas.Canvas,
    cx: float,
    cy: float,
    radius: float,
    amplitude: float,
    waves: int,
    phase: float,
    points: int = 540,
) -> None:
    path = pdf.beginPath()
    for i in range(points + 1):
        t = i / points * math.tau
        r = radius + amplitude * math.sin(waves * t + phase)
        point = (cx + r * math.cos(t), cy + r * math.sin(t))
        if i == 0:
            path.moveTo(*point)
        else:
            path.lineTo(*point)
    path.close()
    pdf.drawPath(path, stroke=1, fill=0)


def _emblem_watermark(pdf: canvas.Canvas, cx: float, cy: float, radius: float) -> None:
    """El emblema de la marca, grande y en un violeta casi blanco, como el fondo de seguridad de
    un certificado: el anillo de 64 marcas de la huella SHA-256 y la banda de guilloché."""
    s = radius / 117
    pdf.saveState()
    pdf.setStrokeColor(WATERMARK)
    pdf.setLineCap(1)
    pdf.setLineWidth(1.6 * s)
    pdf.circle(cx, cy, 117 * s, stroke=1, fill=0)
    pdf.setLineWidth(1 * s)
    for r in (99, 80, 52):
        pdf.circle(cx, cy, r * s, stroke=1, fill=0)
    for i in range(64):
        angle = i / 64 * math.tau + math.pi / 2
        long = i % 8 == 0
        inner = 95 - (10 if long else 5)
        pdf.setLineWidth((1.8 if long else 1) * s)
        c, si = math.cos(angle), math.sin(angle)
        pdf.line(cx + inner * s * c, cy + inner * s * si, cx + 95 * s * c, cy + 95 * s * si)
    pdf.setLineWidth(0.55 * s)
    for k in range(4):
        _guilloche(pdf, cx, cy, 66 * s, 8 * s, 24, k * math.pi / 2)
    pdf.setLineWidth(3 * s)
    _eye(pdf, cx, cy, 84 * s, 34 * s)
    pdf.setLineWidth(2.6 * s)
    pdf.circle(cx, cy, 15.5 * s, stroke=1, fill=0)
    pdf.restoreState()


# Texto ----------------------------------------------------------------------------------------


def _label(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    text: str,
    *,
    color: Color = MUTED,
    right: bool = False,
) -> None:
    """Rótulo de sección: versalitas pequeñas, con un poco de aire entre letras."""
    value = text.upper()
    pdf.setFont(SANS_BOLD, 7)
    pdf.setFillColor(color)
    if right:
        x -= pdfmetrics.stringWidth(value, SANS_BOLD, 7) + 0.6 * (len(value) - 1)
    text_object = pdf.beginText(x, y)
    text_object.setCharSpace(0.6)
    text_object.textOut(value)
    # El espaciado entre letras es parte del estado de texto del PDF y sobrevive al bloque:
    # se devuelve a cero para que no se cuele en el resto del documento.
    text_object.setCharSpace(0)
    pdf.drawText(text_object)


def _text(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    value: str,
    *,
    size: float = 9.5,
    font: str = SANS,
    color: Color = TEXT,
    width: float = 230,
    leading: float = 13.5,
) -> float:
    """Escribe un texto que puede ocupar varias líneas y devuelve dónde queda la siguiente."""
    pdf.setFont(font, size)
    pdf.setFillColor(color)
    for segment in simpleSplit(value, font, size, width):
        pdf.drawString(x, y, segment)
        y -= leading
    return y


def _right(
    pdf: canvas.Canvas, x: float, y: float, value: str, *, font: str, size: float, color: Color
) -> None:
    pdf.setFont(font, size)
    pdf.setFillColor(color)
    pdf.drawRightString(x, y, value)


def _hairline(
    pdf: canvas.Canvas,
    y: float,
    x0: float = MARGIN,
    x1: float = PAGE_W - MARGIN,
    *,
    color: Color = HAIRLINE,
    width: float = 0.7,
) -> None:
    pdf.setStrokeColor(color)
    pdf.setLineWidth(width)
    pdf.line(x0, y, x1, y)


# Documento ------------------------------------------------------------------------------------


def _line_items(receipt: PaymentReceipt) -> Iterable[tuple[str, str, str, str, str]]:
    """Las filas del detalle: descripción, nota, cantidad, valor unitario y valor."""
    period = "al mes" if receipt.billing_cycle == "monthly" else "al año"
    plan_value = receipt.amount_cop - receipt.extra_users_cop
    yield (
        f"Plan {receipt.plan_name} de ALETHEIA",
        f"Suscripción {CYCLES[receipt.billing_cycle].lower()}",
        "1",
        cop(plan_value),
        cop(plan_value),
    )
    if receipt.extra_users > 0:
        people = "usuario adicional" if receipt.extra_users == 1 else "usuarios adicionales"
        unit = receipt.extra_users_cop // receipt.extra_users
        yield (
            f"{receipt.extra_users} {people}",
            f"{cop(unit)} cada uno, {period}",
            str(receipt.extra_users),
            cop(unit),
            cop(receipt.extra_users_cop),
        )


def render(receipt: PaymentReceipt) -> bytes:
    """El comprobante en una página A4, listo para descargar o adjuntar."""
    _register_fonts()
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4, invariant=1, pageCompression=1)
    pdf.setTitle(f"Comprobante de pago {receipt.number}")
    pdf.setAuthor("ALETHEIA")
    pdf.setSubject(f"Pago del plan {receipt.plan_name}")
    pdf.setCreator("ALETHEIA")
    right = PAGE_W - MARGIN

    # Fondo: el emblema como marca de agua, cortado por el borde derecho, y la franja de tinta
    # con su filete de latón en el borde superior.
    _emblem_watermark(pdf, PAGE_W - 30, PAGE_H - 150, 150)
    pdf.setFillColor(INK)
    pdf.rect(0, PAGE_H - 6, PAGE_W, 6, stroke=0, fill=1)
    pdf.setFillColor(BRASS_LIGHT)
    pdf.rect(0, PAGE_H - 7.2, PAGE_W, 1.2, stroke=0, fill=1)

    # Encabezado: la marca a la izquierda, el documento a la derecha.
    top = PAGE_H - 50
    _symbol(pdf, MARGIN, top, 30)
    _logotype(pdf, MARGIN + 42, top - 19.5, 11)
    pdf.setFont(SANS, 7.5)
    pdf.setFillColor(MUTED)
    pdf.drawString(MARGIN + 42, top - 30, "Preservación de evidencia digital")

    _label(pdf, right, top - 4, "Documento de pago", color=BRASS, right=True)
    _right(pdf, right, top - 28, "Comprobante de pago", font=SERIF, size=23, color=TEXT)
    _right(pdf, right, top - 44, f"N.º {receipt.number}", font=MONO, size=9.5, color=INK)

    # Resumen: lo que la persona busca primero, en una franja con tinte.
    y = top - 78
    band_h = 66
    pdf.setFillColor(TINT)
    pdf.setStrokeColor(HAIRLINE)
    pdf.setLineWidth(0.7)
    pdf.roundRect(MARGIN, y - band_h, CONTENT_W, band_h, 10, stroke=1, fill=1)
    cells = (MARGIN + 18, MARGIN + 210, MARGIN + 322)
    label_y = y - 20
    value_y = y - 46
    _label(pdf, cells[0], label_y, "Total pagado")
    _text(pdf, cells[0], value_y, cop(receipt.amount_cop), font=SERIF, size=19, color=INK_DEEP)
    _label(pdf, cells[1], label_y, "Fecha del pago")
    _text(pdf, cells[1], value_y + 2, _day(receipt.issued_at), font=MONO, size=9.5)
    _label(pdf, cells[2], label_y, "Periodo")
    _text(
        pdf,
        cells[2],
        value_y + 2,
        f"{_day(receipt.period_start)} al {_day(receipt.period_end)}",
        font=MONO,
        size=9.5,
        width=160,
    )
    # El estado, como una ficha en la esquina: el verde queda para lo que el sistema comprobó,
    # y Wompi confirmó este pago.
    chip_w, chip_h = 62, 18
    chip_x, chip_y = right - 14 - chip_w, y - 14 - chip_h
    pdf.setFillColor(OK_TINT)
    pdf.roundRect(chip_x, chip_y, chip_w, chip_h, chip_h / 2, stroke=0, fill=1)
    pdf.setFillColor(OK)
    pdf.circle(chip_x + 11, chip_y + chip_h / 2, 2.4, stroke=0, fill=1)
    pdf.setFont(SANS_BOLD, 7.5)
    pdf.drawString(chip_x + 19, chip_y + 6.2, "PAGADO")

    # Partes: quien emite y quien paga, en dos columnas con un filete de latón.
    y -= band_h + 34
    column = CONTENT_W / 2
    for x in (MARGIN, MARGIN + column):
        pdf.setFillColor(BRASS_LIGHT)
        pdf.rect(x, y + 10, 14, 1.4, stroke=0, fill=1)
    _label(pdf, MARGIN, y, "Emitido por")
    _label(pdf, MARGIN + column, y, "Recibido de")
    y_left = _text(pdf, MARGIN, y - 17, SELLER_NAME, font=SANS_BOLD, size=10.5)
    for value in (SELLER_ID, SELLER_TAX, SELLER_ADDRESS, SELLER_EMAIL):
        y_left = _text(pdf, MARGIN, y_left, value, color=MUTED, size=9)
    y_right = _text(
        pdf, MARGIN + column, y - 17, receipt.buyer_name, font=SANS_BOLD, size=10.5, width=230
    )
    if receipt.buyer_email:
        y_right = _text(pdf, MARGIN + column, y_right, receipt.buyer_email, color=MUTED, size=9)
    y_right = _text(
        pdf,
        MARGIN + column,
        y_right,
        f"Emitido el {_long_day(receipt.issued_at)}",
        color=MUTED,
        size=9,
    )
    y = min(y_left, y_right) - 22

    # Detalle: encabezado con filete de tinta y una fila por concepto.
    columns = {
        "description": MARGIN,
        "quantity": MARGIN + 300,
        "unit": MARGIN + 400,
        "value": right,
    }
    _label(pdf, columns["description"], y, "Descripción")
    _label(pdf, columns["quantity"], y, "Cant.", right=True)
    _label(pdf, columns["unit"], y, "Valor unitario", right=True)
    _label(pdf, columns["value"], y, "Valor", right=True)
    y -= 9
    _hairline(pdf, y, color=INK, width=1)
    for description, note, quantity, unit, value in _line_items(receipt):
        y -= 20
        _text(pdf, columns["description"], y, description, font=SANS_MEDIUM, size=10, width=280)
        _text(pdf, columns["description"], y - 14, note, color=MUTED, size=8.5, width=280)
        _right(pdf, columns["quantity"], y, quantity, font=MONO, size=9.5, color=TEXT)
        _right(pdf, columns["unit"], y, unit, font=MONO, size=9.5, color=MUTED)
        _right(pdf, columns["value"], y, value, font=MONO, size=9.5, color=TEXT)
        y -= 26
        _hairline(pdf, y + 4)

    # Totales, alineados a la derecha como en una factura; el total va sobre tinta.
    y -= 18
    labels_x = right - 236

    def total_row(label: str, value: str) -> None:
        nonlocal y
        _text(pdf, labels_x, y, label, color=MUTED, size=9.5)
        _right(pdf, right, y, value, font=MONO, size=9.5, color=TEXT)
        y -= 19

    total_row("Subtotal", cop(receipt.amount_cop))
    total_row("IVA", "No aplica")
    total_h = 38
    y -= total_h - 12
    pdf.setFillColor(INK)
    pdf.roundRect(labels_x - 14, y, right - labels_x + 14, total_h, 8, stroke=0, fill=1)
    _text(pdf, labels_x, y + 15, "Total pagado", font=SANS_BOLD, size=10, color=white)
    _right(pdf, right - 14, y + 13, cop(receipt.amount_cop), font=SERIF, size=16, color=white)
    pdf.setFont(SANS, 7)
    pdf.setFillColor(ON_INK_2)
    pdf.drawString(labels_x, y + 5, "Pesos colombianos")
    y -= 34

    # El pago: medio, transacción y fecha, con un filete de latón a la izquierda.
    facts = (
        ("Medio de pago", method_label(receipt.payment_method), SANS),
        ("Transacción en Wompi", receipt.gateway_transaction_id, MONO),
        ("Fecha del pago", _long_day(receipt.issued_at), SANS),
        ("Referencia", receipt.number, MONO),
    )
    box_h = 34 + 16 * len(facts)
    pdf.setFillColor(white)
    pdf.setStrokeColor(HAIRLINE)
    pdf.setLineWidth(0.7)
    pdf.roundRect(MARGIN, y - box_h, CONTENT_W, box_h, 10, stroke=1, fill=1)
    pdf.setFillColor(BRASS_LIGHT)
    pdf.rect(MARGIN, y - box_h + 12, 2.4, box_h - 24, stroke=0, fill=1)
    inner = y - 22
    _label(pdf, MARGIN + 20, inner, "Datos del pago")
    row = inner - 19
    for label, value, font in facts:
        _text(pdf, MARGIN + 20, row, label, color=MUTED, size=9)
        _text(pdf, MARGIN + 170, row, value, font=font, size=9, width=CONTENT_W - 190)
        row -= 16
    y -= box_h + 26

    # Nota legal y contacto.
    y = _text(pdf, MARGIN, y, NOT_AN_INVOICE, color=MUTED, size=8, width=CONTENT_W, leading=11.5)
    y -= 5
    _text(
        pdf,
        MARGIN,
        y,
        "Conserve este comprobante. Sus derechos como consumidor están en los términos y "
        "condiciones de aletheia.sbs y ante la Superintendencia de Industria y Comercio "
        "(www.sic.gov.co).",
        color=MUTED,
        size=8,
        width=CONTENT_W,
        leading=11.5,
    )

    # Pie de página: una línea de agradecimiento en serif y los datos de contacto.
    foot = MARGIN + 6
    _text(
        pdf,
        MARGIN,
        foot + 30,
        "Gracias por confiar en ALETHEIA para custodiar su evidencia.",
        font=SERIF_ITALIC,
        size=10,
        color=INK_DEEP,
        width=CONTENT_W,
    )
    _hairline(pdf, foot + 18)
    pdf.setFont(SANS, 7.5)
    pdf.setFillColor(MUTED)
    pdf.drawString(MARGIN, foot + 4, f"ALETHEIA     {SELLER_SITE}     {SELLER_EMAIL}")
    pdf.setFont(MONO, 7.5)
    pdf.drawRightString(right, foot + 4, f"{receipt.number}     Página 1 de 1")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
