"""Diseño común de los correos de ALETHEIA: una columna con los colores del sitio.

Los clientes de correo ignoran las hojas de estilo, así que todo va con estilos en línea. Los
textos llegan ya escapados; aquí solo se escapan el botón y su enlace.
"""

import html
from typing import Final

# Colores del sitio: el correo se lee como parte del mismo producto.
_PAGE: Final = "#070b14"
_CARD: Final = "#0e1626"
_TEXT: Final = "#e8eef7"
_MUTED: Final = "#9aa8bd"
_ACTION: Final = "#6cb8f0"
_ACTION_TEXT: Final = "#04101f"


def email_layout(
    greeting: str, paragraphs: list[str], action: tuple[str, str], closing: str
) -> str:
    """Un correo de una columna. Los textos ya llegan escapados."""
    label, url = action
    body = "".join(
        f'<p style="margin:0 0 16px;color:{_TEXT};font-size:16px;line-height:24px">{text}</p>'
        for text in paragraphs
    )
    button = (
        f'<p style="margin:24px 0"><a href="{html.escape(url)}" style="display:inline-block;'
        f"padding:12px 20px;border-radius:6px;background:{_ACTION};color:{_ACTION_TEXT};"
        f'font-weight:600;text-decoration:none">{html.escape(label)}</a></p>'
    )
    return (
        '<!doctype html><html lang="es"><body style="margin:0;padding:0;'
        f'background:{_PAGE}">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:{_PAGE};padding:32px 16px"><tr><td align="center">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="max-width:560px;background:{_CARD};border-radius:12px;padding:32px;'
        'font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">'
        f'<tr><td><p style="margin:0 0 24px;color:{_TEXT};font-size:14px;font-weight:700;'
        'letter-spacing:0.08em">ALETHEIA</p>'
        f'<p style="margin:0 0 16px;color:{_TEXT};font-size:16px;line-height:24px">'
        f"{greeting}</p>{body}{button}"
        f'<p style="margin:0;color:{_MUTED};font-size:13px;line-height:20px">{closing}</p>'
        "</td></tr></table></td></tr></table></body></html>"
    )
