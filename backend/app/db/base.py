"""Base declarativa de los modelos y convención de nombres del esquema."""

import datetime
import uuid
from typing import Any, ClassVar, Final

from sqlalchemy import DateTime, LargeBinary, MetaData, Text, Uuid
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import TypeEngine

# Nombres fijos para llaves, restricciones e índices. Sin ellos, PostgreSQL inventa nombres
# propios y una migración no podría referirse a ellos de forma segura al bajar o modificar.
NAMING_CONVENTION: Final = {
    "pk": "pk_%(table_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
}


class Base(DeclarativeBase):
    """Clase madre de todos los modelos: comparten un mismo catálogo de tablas."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)

    # Tipos de PostgreSQL para cada tipo de Python: texto sin longitud fija (los límites van
    # en restricciones CHECK), fechas siempre con zona horaria (RN-028) y bytes como bytea.
    type_annotation_map: ClassVar[dict[type, TypeEngine[Any]]] = {
        str: Text(),
        datetime.datetime: DateTime(timezone=True),
        uuid.UUID: Uuid(),
        bytes: LargeBinary(),
    }
