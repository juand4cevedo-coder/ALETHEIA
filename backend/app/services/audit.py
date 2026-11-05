"""Datos de la petición que se guardan en la auditoría de seguridad (DAT-10, RN-027)."""

import ipaddress
from typing import Final

_USER_AGENT_MAX: Final = 300


def audit_ip(value: str) -> str | None:
    """La IP para la columna INET, o None si no es una IP, como el cliente de las pruebas."""
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        return None


def audit_user_agent(value: str | None) -> str | None:
    """El agente de usuario recortado al tamaño de la columna."""
    return value[:_USER_AGENT_MAX] if value else None
