"""Forma de las respuestas de error (Problem Details, RFC 9457) tal como la publica el contrato."""

from typing import Annotated, NotRequired, TypedDict

from pydantic import ConfigDict, Field, with_config

# extra="forbid" deja el contrato exacto: el frontend no recibe campos que no conoce, y las
# pruebas fallan si una respuesta trae algo que el contrato no describe.
_EXACT = ConfigDict(extra="forbid")


@with_config(_EXACT)
class ValidationErrorItem(TypedDict):
    """Un dato inválido de la solicitud: dónde está, qué falló y el tipo de error."""

    loc: Annotated[
        list[str | int],
        Field(description="Parte de la solicitud y nombre del campo inválido."),
    ]
    msg: Annotated[str, Field(description="Mensaje del validador.")]
    type: Annotated[str, Field(description="Tipo de error del validador.")]


@with_config(_EXACT)
class Problem(TypedDict):
    """Error en formato Problem Details (RFC 9457)."""

    type: Annotated[str, Field(description="Identificador del tipo de problema.")]
    title: Annotated[str, Field(description="Nombre del código HTTP.")]
    status: Annotated[int, Field(description="Código HTTP de la respuesta.")]
    instance: Annotated[str, Field(description="Ruta de la petición que falló.")]
    detail: NotRequired[Annotated[str, Field(description="Explicación para quien usa la API.")]]
    request_id: NotRequired[
        Annotated[str, Field(description="Identificador para encontrar la petición en registros.")]
    ]


@with_config(_EXACT)
class ValidationProblem(Problem):
    """Problem Details de un 422: agrega la lista de datos inválidos, sin los valores recibidos."""

    errors: Annotated[list[ValidationErrorItem], Field(description="Datos inválidos.")]
