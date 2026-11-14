"""Asignar una única cuenta verificada como administradora propietaria de Aletheia.

Uso desde el contenedor de migraciones, después de que la persona cree y verifique su cuenta:
python -m app.maintenance.platform_owner --email correo@ejemplo.com
"""

import argparse
import datetime
import uuid

from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session

from app.core.config import MigrationSettings
from app.core.secrets import with_database_password
from app.models import AuditLog, User


def grant_platform_owner(session: Session, email: str) -> uuid.UUID:
    """Concede el único cargo de plataforma a una cuenta activa y verificada."""
    database_role = session.scalar(text("SELECT current_user"))
    if database_role != "aletheia_owner":
        raise PermissionError("Esta operación exige el usuario dueño del esquema.")
    user = session.scalar(
        select(User).where(func.lower(User.email) == email.lower()).with_for_update()
    )
    if user is None or user.status != "active" or user.email_verified_at is None:
        raise ValueError("La cuenta no existe, está bloqueada o no confirmó su correo.")
    if user.is_platform_admin:
        return user.id
    current_owner = session.scalar(select(User.id).where(User.is_platform_admin).limit(1))
    if current_owner is not None:
        raise ValueError("Ya existe una cuenta administradora propietaria de Aletheia.")
    user.is_platform_admin = True
    session.add(
        AuditLog(
            organization_id=None,
            actor_user_id=None,
            action="platform_admin_granted",
            target_id=user.id,
            ip=None,
            user_agent=None,
            created_at=datetime.datetime.now(datetime.UTC),
        )
    )
    session.flush()
    return user.id


def main() -> None:
    parser = argparse.ArgumentParser(description="Asignar la cuenta propietaria de Aletheia")
    parser.add_argument("--email", required=True, help="Cuenta activa y con correo verificado")
    args = parser.parse_args()
    settings = with_database_password(MigrationSettings())
    engine = create_engine(
        settings.database_url.get_secret_value().encoded_string(), hide_parameters=True
    )
    try:
        with Session(engine) as session, session.begin():
            grant_platform_owner(session, args.email)
    finally:
        engine.dispose()
    print("Cuenta propietaria de Aletheia asignada o ya estaba asignada.")


if __name__ == "__main__":
    main()
