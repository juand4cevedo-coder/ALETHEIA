"""Diseño común de los correos de ALETHEIA: una columna con los colores de la marca.

Los clientes de correo ignoran las hojas de estilo y casi nunca cargan tipografías propias, así
que todo va con estilos en línea y una pila de fuentes del sistema. Los textos llegan ya
escapados; aquí solo se escapan el botón y su enlace.
"""

import html
from typing import Final

# La paleta Tinta violeta del sitio (ADR-060). El latón solo aparece en el filete bajo la franja
# de tinta, como en el comprobante de pago; todos los textos pasan 4,5:1 sobre su fondo.
_PAGE: Final = "#F6F3FA"
_CARD: Final = "#FFFFFF"
_LINE: Final = "#E4DEEC"
_TEXT: Final = "#17131F"
_TEXT_2: Final = "#3F3949"
_MUTED: Final = "#5D566A"
_INK: Final = "#55278A"
_BRASS: Final = "#D9B871"
_ACTION: Final = _INK
_ACTION_TEXT: Final = "#FFFFFF"
_FONT: Final = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

# El logo se sirve desde una ruta pública estable del sitio: un PNG de 128 px que se muestra a
# 32 px, porque muchos clientes de correo no dibujan SVG.
LOGO_PATH: Final = "/email/logo-claro.png?v=5"
_LOGO_SIZE: Final = 32


def email_layout(
    greeting: str,
    paragraphs: list[str],
    action: tuple[str, str],
    closing: str,
    *,
    site_url: str,
) -> str:
    """Un correo de una columna. Los textos ya llegan escapados; `site_url` es la dirección
    pública del sitio, de donde sale el logo."""
    label, url = action
    logo = html.escape(f"{site_url}{LOGO_PATH}")
    body = "".join(
        f'<p style="margin:0 0 16px;color:{_TEXT_2};font-size:16px;line-height:24px">{text}</p>'
        for text in paragraphs
    )
    button = (
        f'<p style="margin:24px 0 28px"><a href="{html.escape(url)}" style="display:inline-block;'
        f"padding:13px 24px;border-radius:10px;background:{_ACTION};color:{_ACTION_TEXT};"
        f'font-size:16px;font-weight:600;line-height:24px;text-decoration:none">'
        f"{html.escape(label)}</a></p>"
    )
    return (
        '<!doctype html><html lang="es"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" '
        'content="light"></head>'
        f'<body style="margin:0;padding:0;background:{_PAGE}">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:{_PAGE};padding:40px 16px"><tr><td align="center">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="max-width:560px;background:{_CARD};border:1px solid {_LINE};'
        f'border-radius:14px;overflow:hidden;font-family:{_FONT}">'
        # La franja de tinta con su filete de latón, el mismo borde superior del comprobante.
        f'<tr><td style="height:5px;line-height:5px;font-size:0;background:{_INK}">&nbsp;</td></tr>'
        f'<tr><td style="height:1px;line-height:1px;font-size:0;background:{_BRASS}">&nbsp;</td>'
        "</tr>"
        '<tr><td style="padding:32px 36px 36px">'
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 32px"><tr>'
        f'<td style="padding:0 12px 0 0"><img src="{logo}" width="{_LOGO_SIZE}" '
        f'height="{_LOGO_SIZE}" alt="" style="display:block;border:0;border-radius:8px"></td>'
        f'<td style="color:{_INK};font-family:{_FONT};font-size:18px;font-weight:600;'
        'letter-spacing:3px;line-height:32px">ALETHEIA</td>'
        "</tr></table>"
        f'<p style="margin:0 0 16px;color:{_TEXT};font-size:17px;font-weight:600;'
        f'line-height:26px">{greeting}</p>{body}{button}'
        f'<p style="margin:0;padding-top:20px;border-top:1px solid {_LINE};color:{_MUTED};'
        f'font-size:14px;line-height:22px">{closing}</p>'
        "</td></tr></table>"
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="max-width:560px"><tr>'
        f'<td style="padding:20px 36px 0;color:{_MUTED};font-family:{_FONT};font-size:12px;'
        'line-height:18px;text-align:center">ALETHEIA, preservación de evidencia digital para '
        f'abogados en Colombia.<br><a href="{html.escape(site_url)}" style="color:{_MUTED};'
        f'text-decoration:underline">{html.escape(site_url.removeprefix("https://"))}</a></td>'
        "</tr></table>"
        "</td></tr></table></body></html>"
    )
