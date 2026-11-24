"""Los plazos legales se cuentan con los festivos de Colombia."""

import datetime

import pytest

from app.core.business_days import add_business_days, easter_sunday, holidays, is_business_day
from app.services.support import due_on

_BOGOTA = datetime.timezone(datetime.timedelta(hours=-5))


def test_los_festivos_de_2026_son_los_del_calendario_oficial() -> None:
    expected = {
        datetime.date(2026, 1, 1),
        datetime.date(2026, 1, 12),
        datetime.date(2026, 3, 23),
        datetime.date(2026, 4, 2),
        datetime.date(2026, 4, 3),
        datetime.date(2026, 5, 1),
        datetime.date(2026, 5, 18),
        datetime.date(2026, 6, 8),
        datetime.date(2026, 6, 15),
        datetime.date(2026, 6, 29),
        datetime.date(2026, 7, 20),
        datetime.date(2026, 8, 7),
        datetime.date(2026, 8, 17),
        datetime.date(2026, 10, 12),
        datetime.date(2026, 11, 2),
        datetime.date(2026, 11, 16),
        datetime.date(2026, 12, 8),
        datetime.date(2026, 12, 25),
    }
    assert holidays(2026) == expected


@pytest.mark.parametrize(
    ("year", "easter"),
    [
        (2024, datetime.date(2024, 3, 31)),
        (2025, datetime.date(2025, 4, 20)),
        (2027, datetime.date(2027, 3, 28)),
    ],
)
def test_la_pascua_sale_del_algoritmo_gregoriano(year: int, easter: datetime.date) -> None:
    assert easter_sunday(year) == easter


def test_los_fines_de_semana_y_festivos_no_cuentan() -> None:
    assert not is_business_day(datetime.date(2026, 11, 14))
    assert not is_business_day(datetime.date(2026, 11, 16))
    assert is_business_day(datetime.date(2026, 11, 17))
    # Viernes 13 de noviembre de 2026: el lunes 16 es festivo, así que el primer día hábil
    # siguiente es el martes 17.
    assert add_business_days(datetime.date(2026, 11, 13), 1) == datetime.date(2026, 11, 17)


def test_el_plazo_se_cuenta_desde_el_dia_siguiente() -> None:
    with pytest.raises(ValueError, match="días hábiles"):
        add_business_days(datetime.date(2026, 11, 24), 0)
    # Martes 24 de noviembre: diez días hábiles terminan el martes 8 de diciembre, que es
    # festivo, así que el plazo pasa al miércoles 9.
    assert add_business_days(datetime.date(2026, 11, 24), 10) == datetime.date(2026, 12, 9)


def test_cada_tipo_de_solicitud_tiene_su_plazo() -> None:
    received = datetime.datetime(2026, 11, 24, 23, 30, tzinfo=_BOGOTA)
    assert due_on("data_query", received) == datetime.date(2026, 12, 9)
    assert due_on("data_claim", received) == datetime.date(2026, 12, 16)
    assert due_on("consumer", received) == datetime.date(2026, 12, 16)
    assert due_on("refund", received) == datetime.date(2026, 12, 9)
    # Recibida a las 11:30 p. m. del lunes en Colombia, ya es martes en UTC: cuenta el día de
    # Colombia.
    late_monday = datetime.datetime(2026, 11, 23, 23, 30, tzinfo=_BOGOTA)
    assert due_on("data_query", late_monday.astimezone(datetime.UTC)) == datetime.date(2026, 12, 7)
