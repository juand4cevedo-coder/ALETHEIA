"""Cookies de la sesión (ADR-007, ADR-028).

Las dos son HttpOnly, Secure y SameSite=Strict (CA-HU-007-01): ningún script de la página las
lee, solo viajan por HTTPS y el navegador no las envía en peticiones que nazcan en otro sitio.

- La de acceso lleva el prefijo __Host-: el navegador la rechaza si no es Secure, si trae
  dominio o si su ruta no es /, así que ningún subdominio puede plantar una propia.
- La de renovación lleva el prefijo __Secure- y solo viaja a /api/v1/auth, donde están las
  rutas que la usan: no acompaña a ninguna otra petición.
"""

import datetime
from typing import Final

from fastapi import Response

from app.api import API_PREFIX
from app.services.sessions import ACCESS_TOKEN_LIFETIME, IssuedSession

ACCESS_COOKIE: Final = "__Host-aletheia_access"
REFRESH_COOKIE: Final = "__Secure-aletheia_refresh"
REFRESH_COOKIE_PATH: Final = f"{API_PREFIX}/auth"


def set_session_cookies(
    response: Response, issued: IssuedSession, *, now: datetime.datetime | None = None
) -> None:
    """Entrega las dos credenciales de un ingreso; cada cookie vence con su token."""
    now = now or datetime.datetime.now(datetime.UTC)
    response.set_cookie(
        ACCESS_COOKIE,
        issued.access_token,
        max_age=int(ACCESS_TOKEN_LIFETIME.total_seconds()),
        path="/",
        secure=True,
        httponly=True,
        samesite="strict",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        issued.refresh_token,
        max_age=max(int((issued.expires_at - now).total_seconds()), 0),
        path=REFRESH_COOKIE_PATH,
        secure=True,
        httponly=True,
        samesite="strict",
    )


def clear_session_cookies(response: Response) -> None:
    """Borra las dos cookies de la sesión: al cerrarla o cuando la renovación falla.

    El navegador solo borra una cookie si recibe el mismo nombre, ruta y atributos con que la
    guardó; por eso se repiten aquí.
    """
    response.delete_cookie(ACCESS_COOKIE, path="/", secure=True, httponly=True, samesite="strict")
    response.delete_cookie(
        REFRESH_COOKIE,
        path=REFRESH_COOKIE_PATH,
        secure=True,
        httponly=True,
        samesite="strict",
    )
