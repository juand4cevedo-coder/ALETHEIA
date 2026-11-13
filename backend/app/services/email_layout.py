"""Diseño común de los correos de ALETHEIA: una columna con los colores de la marca.

Los clientes de correo ignoran las hojas de estilo y casi nunca cargan tipografías propias, así
que todo va con estilos en línea y una pila de fuentes del sistema. Los textos llegan ya
escapados; aquí solo se escapan el botón y su enlace.
"""

import html
from typing import Final

# La misma paleta de lectura y acción que utiliza el sitio.
_PAGE: Final = "#000000"
_CARD: Final = "#0E0F11"
_LINE: Final = "#252629"
_TEXT: Final = "#F0F0F0"
_TEXT_2: Final = "#A1A4A5"
_MUTED: Final = "#999DA3"
_ACTION: Final = "#F0F0F0"
_ACTION_TEXT: Final = "#08090B"
_FONT: Final = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

# El logo se sirve desde una ruta pública estable del sitio: un PNG de 64 px que se muestra a
# 32 px, porque muchos clientes de correo no dibujan SVG.
LOGO_PATH: Final = "/email/logo-claro.png"
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
        f"padding:12px 22px;border-radius:6px;background:{_ACTION};color:{_ACTION_TEXT};"
        f'font-size:16px;font-weight:600;line-height:24px;text-decoration:none">'
        f"{html.escape(label)}</a></p>"
    )
    return (
        '<!doctype html><html lang="es"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        f'<body style="margin:0;padding:0;background:{_PAGE}">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:{_PAGE};padding:32px 16px"><tr><td align="center">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="max-width:560px;background:{_CARD};border:1px solid {_LINE};'
        f'border-radius:8px;font-family:{_FONT}">'
        '<tr><td style="padding:32px">'
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px"><tr>'
        f'<td style="padding:0 10px 0 0"><img src="{logo}" width="{_LOGO_SIZE}" '
        f'height="{_LOGO_SIZE}" alt="" style="display:block;border:0"></td>'
        f'<td style="color:{_TEXT};font-family:{_FONT};font-size:24px;'
        'font-weight:700;line-height:32px">Aletheia</td>'
        "</tr></table>"
        f'<p style="margin:0 0 16px;color:{_TEXT};font-size:16px;line-height:24px">'
        f"{greeting}</p>{body}{button}"
        f'<p style="margin:0;padding-top:20px;border-top:1px solid {_LINE};color:{_MUTED};'
        f'font-size:14px;line-height:22px">{closing}</p>'
        "</td></tr></table></td></tr></table></body></html>"
    )
