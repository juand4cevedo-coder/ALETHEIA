"""Comprobante de pago de ALETHEIA en PDF, una página A4.

Lleva el formato de una factura profesional (quién emite, quién paga, detalle, totales y datos
del pago), pero se llama comprobante de pago: el vendedor es persona natural no responsable de
IVA y no expide factura electrónica, así que llamarlo factura sería inexacto. El símbolo de la
marca se dibuja con trazos vectoriales, sin imágenes, para que el archivo sea liviano y nítido.
"""

import datetime
import io
from importlib.resources import files
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
FONT: Final = "AletheiaReceipt"
FONT_BOLD: Final = "AletheiaReceiptBold"

# Quien vende: los mismos datos de los términos y condiciones (frontend/src/config/legal.ts).
SELLER_NAME: Final = "Juan Diego Acevedo Calderón"
SELLER_ID: Final = "NIT 1214744661-9"
SELLER_TAX: Final = "Persona natural no responsable de IVA"
SELLER_ADDRESS: Final = "Avenida 40 # 62-56, Bello, Antioquia, Colombia"
SELLER_EMAIL: Final = "contacto@aletheia.sbs"
SELLER_SITE: Final = "aletheia.sbs"

VIOLET: Final = HexColor("#820ad1")
INK: Final = HexColor("#111111")
MUTED: Final = HexColor("#5f5f5f")
HAIRLINE: Final = HexColor("#e4dcec")
TINT: Final = HexColor("#f6f0fb")
OK: Final = HexColor("#1f6b4a")

PAGE_W, PAGE_H = A4
MARGIN: Final = 48


def _register_fonts() -> None:
    root = files("reportlab").joinpath("fonts")
    if FONT not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(FONT, str(root.joinpath("Vera.ttf"))))
        pdfmetrics.registerFont(TTFont(FONT_BOLD, str(root.joinpath("VeraBd.ttf"))))


def _day(value: datetime.datetime) -> str:
    return value.astimezone(_BOGOTA).strftime("%d/%m/%Y")


def _symbol(pdf: canvas.Canvas, left: float, top: float, size: float) -> None:
    """El símbolo de Aletheia: recuadro violeta y ojo blanco, en su cuadrícula de 64."""
    scale = size / 64

    def point(x: float, y: float) -> tuple[float, float]:
        return left + x * scale, top - y * scale

    pdf.setFillColor(VIOLET)
    pdf.roundRect(left, top - size, size, size, 18 * scale, stroke=0, fill=1)
    eye = pdf.beginPath()
    eye.moveTo(*point(9, 32))
    eye.curveTo(*point(17, 21), *point(25, 16), *point(32, 16))
    eye.curveTo(*point(39, 16), *point(47, 21), *point(55, 32))
    eye.curveTo(*point(47, 43), *point(39, 48), *point(32, 48))
    eye.curveTo(*point(25, 48), *point(17, 43), *point(9, 32))
    eye.close()
    pdf.setStrokeColor(white)
    pdf.setLineWidth(4 * scale)
    pdf.setLineJoin(1)
    pdf.drawPath(eye, stroke=1, fill=0)
    pdf.setFillColor(white)
    pdf.circle(*point(32, 32), 8.5 * scale, stroke=0, fill=1)
    pdf.setFillColor(VIOLET)
    pdf.circle(*point(32, 32), 3.5 * scale, stroke=0, fill=1)


def _label(pdf: canvas.Canvas, x: float, y: float, text: str) -> None:
    """Rótulo de sección: mayúsculas pequeñas en gris."""
    pdf.setFont(FONT_BOLD, 7.5)
    pdf.setFillColor(MUTED)
    pdf.drawString(x, y, text.upper())


def _text(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    value: str,
    *,
    size: float = 9.5,
    bold: bool = False,
    color: Color = INK,
    width: float = 230,
    leading: float = 13,
) -> float:
    """Escribe un texto que puede ocupar varias líneas y devuelve dónde queda la siguiente."""
    font = FONT_BOLD if bold else FONT
    pdf.setFont(font, size)
    pdf.setFillColor(color)
    for segment in simpleSplit(value, font, size, width):
        pdf.drawString(x, y, segment)
        y -= leading
    return y


def _hairline(
    pdf: canvas.Canvas, y: float, x0: float = MARGIN, x1: float = PAGE_W - MARGIN
) -> None:
    pdf.setStrokeColor(HAIRLINE)
    pdf.setLineWidth(0.8)
    pdf.line(x0, y, x1, y)


def render(receipt: PaymentReceipt) -> bytes:
    """El comprobante en una página A4, listo para descargar o adjuntar."""
    _register_fonts()
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4, invariant=1, pageCompression=1)
    pdf.setTitle(f"Comprobante de pago {receipt.number}")
    pdf.setAuthor("ALETHEIA")
    pdf.setSubject(f"Pago del plan {receipt.plan_name}")
    right = PAGE_W - MARGIN

    # Encabezado: la marca a la izquierda, el documento a la derecha.
    top = PAGE_H - MARGIN
    _symbol(pdf, MARGIN, top, 34)
    pdf.setFont(FONT_BOLD, 19)
    pdf.setFillColor(VIOLET)
    pdf.drawString(MARGIN + 44, top - 24, "Aletheia")
    pdf.setFont(FONT, 8)
    pdf.setFillColor(MUTED)
    pdf.drawString(MARGIN + 44, top - 36, "Preservación de evidencia digital")

    pdf.setFont(FONT_BOLD, 17)
    pdf.setFillColor(INK)
    pdf.drawRightString(right, top - 14, "Comprobante de pago")
    pdf.setFont(FONT_BOLD, 10)
    pdf.drawRightString(right, top - 30, f"N.º {receipt.number}")
    pdf.setFont(FONT, 9)
    pdf.setFillColor(MUTED)
    pdf.drawRightString(right, top - 43, f"Emitido el {_day(receipt.issued_at)}")

    y = top - 66
    _hairline(pdf, y)

    # Partes: quien emite y quien paga, en dos columnas.
    y -= 26
    column = (PAGE_W - 2 * MARGIN) / 2
    _label(pdf, MARGIN, y, "Emitido por")
    _label(pdf, MARGIN + column, y, "Recibido de")
    y_left = _text(pdf, MARGIN, y - 16, SELLER_NAME, bold=True, size=10.5)
    for value in (SELLER_ID, SELLER_TAX, SELLER_ADDRESS, SELLER_EMAIL):
        y_left = _text(pdf, MARGIN, y_left, value, color=MUTED)
    y_right = _text(pdf, MARGIN + column, y - 16, receipt.buyer_name, bold=True, size=10.5)
    if receipt.buyer_email:
        y_right = _text(pdf, MARGIN + column, y_right, receipt.buyer_email, color=MUTED)
    y = min(y_left, y_right) - 20

    # Detalle: una fila por servicio, con encabezado sobre un tinte suave.
    columns = (MARGIN + 12, MARGIN + 270, right - 12)
    pdf.setFillColor(TINT)
    pdf.roundRect(MARGIN, y - 8, PAGE_W - 2 * MARGIN, 26, 6, stroke=0, fill=1)
    _label(pdf, columns[0], y, "Descripción")
    _label(pdf, columns[1], y, "Periodo")
    pdf.setFont(FONT_BOLD, 7.5)
    pdf.setFillColor(MUTED)
    pdf.drawRightString(columns[2], y, "VALOR")
    y -= 30
    _text(pdf, columns[0], y, f"Plan {receipt.plan_name} de ALETHEIA", bold=True, size=10)
    _text(
        pdf,
        columns[0],
        y - 14,
        f"Suscripción {CYCLES[receipt.billing_cycle].lower()}",
        color=MUTED,
        size=9,
    )
    _text(
        pdf,
        columns[1],
        y,
        f"{_day(receipt.period_start)} al {_day(receipt.period_end)}",
        size=9.5,
    )
    pdf.setFont(FONT, 10)
    pdf.setFillColor(INK)
    pdf.drawRightString(columns[2], y, cop(receipt.amount_cop - receipt.extra_users_cop))
    if receipt.extra_users > 0:
        # Las personas por encima de las que incluye el plan, en una fila propia.
        y -= 36
        people = "usuario adicional" if receipt.extra_users == 1 else "usuarios adicionales"
        unit = receipt.extra_users_cop // receipt.extra_users
        _text(pdf, columns[0], y, f"{receipt.extra_users} {people}", bold=True, size=10)
        _text(
            pdf,
            columns[0],
            y - 14,
            f"{cop(unit)} cada uno, {'al mes' if receipt.billing_cycle == 'monthly' else 'al año'}",
            color=MUTED,
            size=9,
        )
        _text(
            pdf,
            columns[1],
            y,
            f"{_day(receipt.period_start)} al {_day(receipt.period_end)}",
            size=9.5,
        )
        pdf.setFont(FONT, 10)
        pdf.setFillColor(INK)
        pdf.drawRightString(columns[2], y, cop(receipt.extra_users_cop))
    y -= 32
    _hairline(pdf, y)

    # Totales, alineados a la derecha como en una factura.
    y -= 22
    labels_x = right - 210

    def total_row(label: str, value: str, *, strong: bool = False) -> None:
        nonlocal y
        pdf.setFont(FONT_BOLD if strong else FONT, 11 if strong else 9.5)
        pdf.setFillColor(INK if strong else MUTED)
        pdf.drawString(labels_x, y, label)
        pdf.setFillColor(VIOLET if strong else INK)
        pdf.setFont(FONT_BOLD if strong else FONT, 13 if strong else 9.5)
        pdf.drawRightString(right - 12, y, value)
        y -= 24 if strong else 18

    total_row("Subtotal", cop(receipt.amount_cop))
    total_row("IVA", "No aplica")
    _hairline(pdf, y + 8, labels_x, right)
    y -= 6
    total_row("Total pagado", cop(receipt.amount_cop), strong=True)

    # El pago: estado, medio y transacción, en un recuadro.
    y -= 10
    box_h = 86
    pdf.setStrokeColor(HAIRLINE)
    pdf.setLineWidth(0.8)
    pdf.roundRect(MARGIN, y - box_h, PAGE_W - 2 * MARGIN, box_h, 8, stroke=1, fill=0)
    inner = y - 22
    _label(pdf, MARGIN + 16, inner, "Datos del pago")
    pdf.setFont(FONT_BOLD, 8)
    pdf.setFillColor(OK)
    pdf.drawRightString(right - 16, inner, "PAGADO")
    facts = (
        ("Medio de pago", method_label(receipt.payment_method)),
        ("Transacción en Wompi", receipt.gateway_transaction_id),
        ("Fecha del pago", _day(receipt.issued_at)),
    )
    row = inner - 18
    for label, value in facts:
        _text(pdf, MARGIN + 16, row, label, color=MUTED, size=9)
        _text(pdf, MARGIN + 170, row, value, size=9, width=PAGE_W - 2 * MARGIN - 190)
        row -= 15
    y -= box_h + 26

    # Nota legal y contacto.
    y = _text(
        pdf, MARGIN, y, NOT_AN_INVOICE, color=MUTED, size=8.5, width=PAGE_W - 2 * MARGIN, leading=12
    )
    y -= 6
    _text(
        pdf,
        MARGIN,
        y,
        "Conserve este comprobante. Sus derechos como consumidor están en los términos y "
        "condiciones de aletheia.sbs y ante la Superintendencia de Industria y Comercio "
        "(www.sic.gov.co).",
        color=MUTED,
        size=8.5,
        width=PAGE_W - 2 * MARGIN,
        leading=12,
    )

    # Pie de página.
    _hairline(pdf, MARGIN + 18)
    pdf.setFont(FONT, 8)
    pdf.setFillColor(MUTED)
    pdf.drawString(MARGIN, MARGIN + 4, f"ALETHEIA   {SELLER_SITE}   {SELLER_EMAIL}")
    pdf.drawRightString(right, MARGIN + 4, f"Comprobante {receipt.number}")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
