"""Dependencias compartidas por las rutas de la API."""

from collections.abc import Iterator
from typing import Annotated, Final

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyCookie
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.adapters.keys import KeyWrapper
from app.api.cookies import ACCESS_COOKIE
from app.core.config import Settings
from app.core.legal import LegalAcceptanceRequiredError
from app.services import sessions as sessions_service
from app.services.members import MANAGER_ROLES
from app.services.sessions import NotAuthenticatedError, Principal


def get_engine(request: Request) -> Engine:
    """Entrega el motor de base de datos creado al construir la aplicación."""
    engine = request.app.state.engine
    if not isinstance(engine, Engine):
        msg = "La aplicación no tiene motor de base de datos"
        raise TypeError(msg)
    return engine


def get_key_wrapper(request: Request) -> KeyWrapper:
    """El envoltorio de llaves (AWS KMS o la llave local) creado al construir la aplicación."""
    wrapper: KeyWrapper = request.app.state.key_wrapper
    return wrapper


def get_session(engine: Annotated[Engine, Depends(get_engine)]) -> Iterator[Session]:
    """Sesión de SQLAlchemy por petición; se cierra al terminar la respuesta."""
    with Session(engine) as session:
        yield session


def get_app_settings(request: Request) -> Settings:
    """La configuración de la aplicación que atiende la petición."""
    settings: Settings = request.app.state.settings
    return settings


def get_client_ip(request: Request) -> str:
    """IP de quien llama. En producción uvicorn la toma de X-Forwarded-For, que Caddy reemplaza
    con la IP real del visitante; nunca la del propio Caddy."""
    if request.client is None:
        # Solo ocurre fuera de un servidor HTTP real; todas esas llamadas comparten un límite.
        return "desconocida"
    return request.client.host


# Declara en el contrato que las rutas protegidas piden la cookie de acceso. auto_error=False:
# la cookie que falta se responde igual que una inválida, con el 401 de abajo.
_access_cookie = APIKeyCookie(
    name=ACCESS_COOKIE,
    scheme_name="sesion",
    description="Cookie de acceso que la API entrega al ingresar.",
    auto_error=False,
)

SESSION_ENDED: Final = "Su sesión terminó. Ingrese de nuevo."
# RFC 9110 pide un desafío en todo 401. La sesión viaja en una cookie, así que el desafío solo
# nombra el mecanismo; el navegador no muestra ningún cuadro de diálogo por él.
SESSION_CHALLENGE: Final = 'Cookie realm="aletheia"'


def get_principal_allowing_outdated_legal(
    access_token: Annotated[str | None, Depends(_access_cookie)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> Principal:
    """Quién hace la petición, haya aceptado o no los textos legales vigentes.

    Solo para lo que debe seguir funcionando antes de aceptarlos: ver el perfil, aceptar los
    textos, cerrar la sesión y, cuando existan, descargar y exportar los casos, porque los
    términos prometen que la evidencia nunca queda retenida. Sin una sesión viva, 401 sin más
    detalle (RN-026).
    """
    try:
        return sessions_service.authenticate(session, settings, access_token)
    except NotAuthenticatedError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail=SESSION_ENDED,
            headers={"WWW-Authenticate": SESSION_CHALLENGE, "Cache-Control": "no-store"},
        ) from None


def get_principal(
    principal: Annotated[Principal, Depends(get_principal_allowing_outdated_legal)],
) -> Principal:
    """Quién hace la petición, con los textos legales vigentes aceptados (RN-029).

    Es la dependencia por defecto de toda ruta con sesión: quien no los ha aceptado recibe un
    403 con el tipo LEGAL_ACCEPTANCE_REQUIRED y la interfaz le muestra los textos nuevos.
    """
    if not principal.accepted_current_legal:
        raise LegalAcceptanceRequiredError
    return principal


# MSG-010 del catálogo de mensajes (Diseño UX/UI, 14.2).
NOT_ALLOWED: Final = (
    "No tiene permiso para esta acción. Si lo necesita, pídalo al propietario o al "
    "administrador de su organización."
)


def get_manager(principal: Annotated[Principal, Depends(get_principal)]) -> Principal:
    """Quien hace la petición, si es propietario o administrador de su organización.

    Gestionar el equipo es solo de esos dos roles (RN-008, CA-HU-011-03). Los servicios lo
    vuelven a comprobar: la autorización no depende de que la ruta recuerde pedir esta
    dependencia.
    """
    if principal.organization_id is None or principal.role not in MANAGER_ROLES:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail=NOT_ALLOWED,
            headers={"Cache-Control": "no-store"},
        )
    return principal
