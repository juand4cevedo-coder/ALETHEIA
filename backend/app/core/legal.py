"""Textos legales vigentes: los términos y la política de privacidad (RN-029).

Se identifican por la fecha desde la que rigen, en formato AAAA-MM-DD, y esa fecha es lo que
users guarda como versión aceptada. Debe ser la misma de LEGAL_VERSION en
frontend/src/config/legal.ts; una prueba lo comprueba. Cuando un cambio altera derechos u
obligaciones, la fecha cambia en los dos lugares a la vez.
"""

from typing import Final

LEGAL_VERSION: Final = "2026-11-06"
