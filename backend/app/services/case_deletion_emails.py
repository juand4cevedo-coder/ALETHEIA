"""Constancia de eliminación por correo (SEQ-004).

Se arma con la constancia permanente que dejó `purge_case`. No lleva el título del caso ni los
nombres de los archivos: ya no existen y el correo viaja fuera de ALETHEIA.
"""

import html
from typing import Any

from sqlalchemy.orm import Session

from app.adapters.email import REPLY_TO, OutgoingEmail
from app.core.config import Settings
from app.services.case_deletion import RECEIPT_TEMPLATE, receipt_facts
from app.services.email_layout import email_layout
from app.services.notifications import email_template
from app.services.organization_emails import colombian_datetime


@email_template(RECEIPT_TEMPLATE)
def receipt_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    record, user, organization = receipt_facts(session, payload)
    destroyed = colombian_datetime(record.key_destroyed_at)
    backups = colombian_datetime(record.backups_expire_at)
    count = record.evidence_count
    megabytes = f"{record.total_bytes / (1024 * 1024):.1f}".replace(".", ",")
    files = "1 evidencia" if count == 1 else f"{count} evidencias"
    name = user.full_name
    return OutgoingEmail(
        to=user.email,
        subject=f"Constancia de eliminación de un caso de {organization}",
        text=(
            f"Hola, {name}:\n\n"
            f"El caso que usted pidió eliminar en {organization} ya no existe en ALETHEIA.\n\n"
            f"- Se eliminaron {files} ({megabytes} MB), la cadena de custodia, las notas, las "
            "tareas y lo compartido con el cliente.\n"
            f"- La llave de cifrado del caso se destruyó el {destroyed} (hora de Colombia).\n"
            f"- Los respaldos conservan una copia cifrada, ya sin llave, hasta el {backups}.\n\n"
            "ALETHEIA guarda esta constancia de forma permanente, con las huellas SHA-256 de "
            "lo eliminado y sin nombres de archivo ni contenido. Con ella se puede probar que "
            "el caso existió y que se eliminó, sin conservar su contenido.\n\n"
            f"Dudas: {REPLY_TO}.\n\n"
            "ALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [
                "El caso que usted pidió eliminar en "
                f"<strong>{html.escape(organization)}</strong> ya no existe en ALETHEIA.",
                f"Se eliminaron {files} ({megabytes} MB), la cadena de custodia, las notas, "
                "las tareas y lo compartido con el cliente.",
                f"La llave de cifrado del caso se destruyó el {html.escape(destroyed)} (hora "
                f"de Colombia). Los respaldos conservan una copia cifrada, ya sin llave, hasta "
                f"el {html.escape(backups)}.",
                "ALETHEIA guarda esta constancia de forma permanente, con las huellas SHA-256 "
                "de lo eliminado y sin nombres de archivo ni contenido.",
            ],
            ("Ir a ALETHEIA", settings.public_url),
            f"Dudas: {html.escape(REPLY_TO)}.",
            site_url=settings.public_url,
        ),
    )
