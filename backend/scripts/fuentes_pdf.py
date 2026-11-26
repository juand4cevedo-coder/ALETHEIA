"""Genera las tipografías estáticas que usan los PDF del servidor (el comprobante de pago).

reportlab solo incrusta TrueType estático, y el sitio publica Geist, Newsreader y Geist Mono
como WOFF2 variables. Este script toma esos mismos archivos de frontend/node_modules, fija cada
eje en el valor que necesita el documento y guarda un TTF por estilo en app/assets/fonts. Así el
PDF usa la tipografía de la marca sin depender de fuentes del sistema.

Se corre solo cuando cambia la versión de las fuentes, con fontTools y brotli de paso:

    uv run --no-project --with fonttools --with brotli python scripts/fuentes_pdf.py
"""

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

RAIZ = Path(__file__).resolve().parents[1]
ORIGEN = RAIZ.parent / "frontend" / "node_modules" / "@fontsource-variable"
DESTINO = RAIZ / "app" / "assets" / "fonts"

# Nombre del archivo, WOFF2 de origen y valor de cada eje.
ESTILOS = (
    ("Geist-Regular", "geist/files/geist-latin-wght-normal.woff2", {"wght": 400}),
    ("Geist-Medium", "geist/files/geist-latin-wght-normal.woff2", {"wght": 500}),
    ("Geist-SemiBold", "geist/files/geist-latin-wght-normal.woff2", {"wght": 600}),
    (
        "Newsreader-Display",
        "newsreader/files/newsreader-latin-opsz-normal.woff2",
        {"wght": 500, "opsz": 48},
    ),
    (
        "Newsreader-Italic",
        "newsreader/files/newsreader-latin-opsz-italic.woff2",
        {"wght": 400, "opsz": 16},
    ),
    ("GeistMono-Regular", "geist-mono/files/geist-mono-latin-wght-normal.woff2", {"wght": 400}),
)


def main() -> None:
    DESTINO.mkdir(parents=True, exist_ok=True)
    for nombre, origen, ejes in ESTILOS:
        fuente = TTFont(ORIGEN / origen)
        disponibles = {eje.axisTag for eje in fuente["fvar"].axes}
        fija = {eje: valor for eje, valor in ejes.items() if eje in disponibles}
        estatica = instantiateVariableFont(fuente, fija, updateFontNames=False)
        estatica.flavor = None
        estatica.save(DESTINO / f"{nombre}.ttf")
        print(nombre, fija)


if __name__ == "__main__":
    main()
