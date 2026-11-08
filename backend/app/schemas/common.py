"""Tipos que comparten varios esquemas de la API."""

from typing import Annotated

from pydantic import StringConstraints

# Correo: sin espacios, en minúsculas y con la forma mínima de una dirección. Va como alias
# simple, no con type, para que el contrato lo describa en cada campo y no como un esquema
# aparte.
Email = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        max_length=254,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    ),
]
