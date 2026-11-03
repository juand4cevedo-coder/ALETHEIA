"""Correo transaccional (INT-04, ADR-024): Mailpit en desarrollo y pruebas, Amazon SES en
producción.

Ningún correo lleva contenido de casos: solo avisos, enlaces y constancias. El adaptador no
registra destinatarios en los registros, porque un correo es un dato personal.
"""

import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from typing import TYPE_CHECKING, Final, Protocol

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import Settings

if TYPE_CHECKING:
    from mypy_boto3_sesv2 import SESV2Client
    from mypy_boto3_sesv2.type_defs import BodyTypeDef

# Identidad verificada en Amazon SES con DKIM, MAIL FROM bounce.aletheia.sbs y DMARC. El rol
# de IAM de producción solo permite enviar desde esta dirección.
SENDER_ADDRESS: Final = "notificaciones@aletheia.sbs"
SENDER: Final = f"ALETHEIA <{SENDER_ADDRESS}>"
# Las respuestas llegan al buzón de contacto que publican las políticas legales.
REPLY_TO: Final = "contacto@aletheia.sbs"
_MESSAGE_ID_DOMAIN: Final = "aletheia.sbs"
_SMTP_TIMEOUT_SECONDS: Final = 10

# Errores de SES que no se arreglan reintentando: el mensaje o la dirección son inválidos.
_PERMANENT_SES_ERRORS: Final = frozenset({"MessageRejected", "BadRequestException"})

# Si SES no responde, la tarea falla pronto y el trabajador la reintenta más tarde.
_SES_CLIENT_CONFIG: Final = Config(
    connect_timeout=5,
    read_timeout=10,
    retries={"max_attempts": 3, "mode": "standard"},
)


@dataclass(frozen=True, slots=True)
class OutgoingEmail:
    """Un correo listo para enviar, en texto y opcionalmente en HTML."""

    to: str
    subject: str
    text: str
    html: str | None = None

    def __post_init__(self) -> None:
        # Un salto de línea en una cabecera permitiría inyectar otras, como Bcc.
        for field, value in (("to", self.to), ("subject", self.subject)):
            if "\r" in value or "\n" in value:
                msg = f"El campo {field} no puede tener saltos de línea."
                raise ValueError(msg)
        if self.to.count("@") != 1 or self.to.startswith("@") or self.to.endswith("@"):
            msg = "El destinatario no es una dirección de correo."
            raise ValueError(msg)


class EmailDeliveryError(RuntimeError):
    """No se pudo entregar el correo al servidor de envío.

    permanent indica que reintentar no sirve: el mensaje o la dirección son inválidos. El
    mensaje nombra la causa, nunca el destinatario.
    """

    def __init__(self, message: str, *, permanent: bool) -> None:
        super().__init__(message)
        self.permanent = permanent


class EmailSender(Protocol):
    """Lo único que el resto del backend sabe del correo."""

    def send(self, email: OutgoingEmail) -> None:
        """Entrega el correo al servidor de envío o lanza EmailDeliveryError."""
        ...


class SmtpEmailSender:
    """Envía por SMTP sin cifrar. Solo para Mailpit en el propio equipo o en la CI."""

    def __init__(self, host: str, port: int) -> None:
        self._host = host
        self._port = port

    def send(self, email: OutgoingEmail) -> None:
        message = EmailMessage()
        message["From"] = SENDER
        message["To"] = email.to
        message["Reply-To"] = REPLY_TO
        message["Subject"] = email.subject
        message["Date"] = formatdate(usegmt=True)
        message["Message-ID"] = make_msgid(domain=_MESSAGE_ID_DOMAIN)
        message.set_content(email.text)
        if email.html is not None:
            message.add_alternative(email.html, subtype="html")

        try:
            with smtplib.SMTP(self._host, self._port, timeout=_SMTP_TIMEOUT_SECONDS) as smtp:
                smtp.send_message(message)
        except smtplib.SMTPRecipientsRefused:
            msg = "El servidor SMTP rechazó el destinatario."
            raise EmailDeliveryError(msg, permanent=True) from None
        except (smtplib.SMTPException, OSError) as exc:
            msg = f"No se pudo enviar por SMTP ({type(exc).__name__})."
            raise EmailDeliveryError(msg, permanent=False) from None


class SesEmailSender:
    """Envía con la API v2 de Amazon SES y las credenciales del rol de la máquina."""

    def __init__(self, client: SESV2Client) -> None:
        self._client = client

    def send(self, email: OutgoingEmail) -> None:
        body: BodyTypeDef = {"Text": {"Data": email.text, "Charset": "UTF-8"}}
        if email.html is not None:
            body["Html"] = {"Data": email.html, "Charset": "UTF-8"}
        try:
            self._client.send_email(
                FromEmailAddress=SENDER,
                Destination={"ToAddresses": [email.to]},
                ReplyToAddresses=[REPLY_TO],
                Content={
                    "Simple": {
                        "Subject": {"Data": email.subject, "Charset": "UTF-8"},
                        "Body": body,
                    }
                },
            )
        except ClientError as exc:
            # Solo el código del error: la respuesta puede repetir la dirección.
            code = exc.response.get("Error", {}).get("Code", "desconocido")
            msg = f"Amazon SES no aceptó el correo ({code})."
            raise EmailDeliveryError(msg, permanent=code in _PERMANENT_SES_ERRORS) from None
        except BotoCoreError as exc:
            # Sin red, sin región o sin credenciales del rol.
            msg = f"No se pudo llegar a Amazon SES ({type(exc).__name__})."
            raise EmailDeliveryError(msg, permanent=False) from None


def ses_client() -> SESV2Client:
    """Cliente de Amazon SES; la región sale de AWS_DEFAULT_REGION."""
    return boto3.client("sesv2", config=_SES_CLIENT_CONFIG)


def build_email_sender(settings: Settings) -> EmailSender:
    """Amazon SES en producción y Mailpit en cualquier otro entorno, sin excepciones: así un
    equipo de desarrollo nunca envía un correo real y producción nunca usa SMTP sin cifrar."""
    if settings.environment == "production":
        return SesEmailSender(ses_client())
    return SmtpEmailSender(settings.smtp_host, settings.smtp_port)
