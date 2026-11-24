"""Días hábiles en Colombia para contar los plazos de respuesta a los titulares y consumidores.

La Ley 1581 de 2012 (arts. 14 y 15) y la Ley 1480 de 2011 cuentan los plazos en días hábiles.
Un día hábil es de lunes a viernes y no es festivo. Los festivos salen de la Ley 51 de 1983:
unos caen siempre en su fecha, otros se trasladan al lunes siguiente, y los de Semana Santa y
los que dependen de ella se cuentan desde el domingo de Pascua.
"""

import datetime
from functools import cache

# Siempre en su fecha: año nuevo, trabajo, independencia, batalla de Boyacá, Inmaculada
# Concepción y Navidad.
_FIXED: tuple[tuple[int, int], ...] = ((1, 1), (5, 1), (7, 20), (8, 7), (12, 8), (12, 25))

# Se trasladan al lunes siguiente si no caen en lunes (Ley 51 de 1983, art. 1): Reyes, San José,
# San Pedro y San Pablo, Asunción, Día de la Raza, Todos los Santos e independencia de Cartagena.
_MOVED_TO_MONDAY: tuple[tuple[int, int], ...] = (
    (1, 6),
    (3, 19),
    (6, 29),
    (8, 15),
    (10, 12),
    (11, 1),
    (11, 11),
)


def easter_sunday(year: int) -> datetime.date:
    """Domingo de Pascua del calendario gregoriano (algoritmo de Meeus, Jones y Butcher)."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7  # noqa: E741 - nombre del algoritmo publicado
    m = (a + 11 * h + 22 * l) // 451
    month, day = divmod(h + l - 7 * m + 114, 31)
    return datetime.date(year, month, day + 1)


def _next_monday(day: datetime.date) -> datetime.date:
    return day + datetime.timedelta(days=(7 - day.weekday()) % 7)


@cache
def holidays(year: int) -> frozenset[datetime.date]:
    """Los dieciocho festivos nacionales de un año."""
    days = {datetime.date(year, month, day) for month, day in _FIXED}
    days |= {_next_monday(datetime.date(year, month, day)) for month, day in _MOVED_TO_MONDAY}
    easter = easter_sunday(year)
    # Jueves y Viernes Santo, en su fecha.
    days |= {easter - datetime.timedelta(days=3), easter - datetime.timedelta(days=2)}
    # Ascensión, Corpus Christi y Sagrado Corazón: a 39, 60 y 68 días de Pascua, que siempre es
    # domingo; el traslado los deja en el lunes siguiente (43, 64 y 71 días).
    days |= {easter + datetime.timedelta(days=offset) for offset in (43, 64, 71)}
    return frozenset(days)


def is_business_day(day: datetime.date) -> bool:
    return day.weekday() < 5 and day not in holidays(day.year)


def add_business_days(start: datetime.date, count: int) -> datetime.date:
    """El día hábil número `count` contado desde el día siguiente a `start`."""
    if count < 1:
        raise ValueError("El plazo se cuenta en días hábiles enteros y positivos.")
    day = start
    remaining = count
    while remaining:
        day += datetime.timedelta(days=1)
        if is_business_day(day):
            remaining -= 1
    return day
