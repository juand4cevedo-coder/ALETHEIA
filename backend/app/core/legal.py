"""Textos legales vigentes: los términos y la política de privacidad (RN-029).

Se identifican por la fecha desde la que rigen, en formato AAAA-MM-DD, y esa fecha es lo que
users guarda como versión aceptada. Debe ser la misma de LEGAL_VERSION en
frontend/src/config/legal.ts; una prueba lo comprueba. Cuando un cambio altera derechos u
obligaciones, la fecha cambia en los dos lugares a la vez.
"""

from typing import Final

LEGAL_VERSION: Final = "2026-11-27"

# Tipo de Problem Details de un 403 por textos sin aceptar. Es un identificador, no una página:
# la interfaz lo compara tal cual para mostrar los textos nuevos.
LEGAL_ACCEPTANCE_REQUIRED: Final = "https://aletheia.sbs/problemas/aceptar-textos-legales"


class LegalAcceptanceRequiredError(Exception):
    """La persona tiene sesión, pero no ha aceptado los textos legales vigentes (RN-029)."""


# Tipo de Problem Details de un 403 porque el despacho exige el segundo factor y la persona aún
# no lo tiene. La interfaz lo compara tal cual para llevarla a activarlo.
TWO_FACTOR_SETUP_REQUIRED: Final = "https://aletheia.sbs/problemas/activar-segundo-factor"


class TwoFactorSetupRequiredError(Exception):
    """El despacho exige el segundo factor y esta persona todavía no lo ha activado."""
