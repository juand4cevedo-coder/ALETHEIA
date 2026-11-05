"""Pruebas del correo transaccional: Mailpit en desarrollo y pruebas, Amazon SES en producción."""

import os
import time
import uuid
from collections.abc import Iterator
from typing import Any

import boto3
import httpx2
import pytest
from botocore.stub import Stubber

from app.adapters import email as email_adapter
from app.adapters.email import (
    REPLY_TO,
    SENDER,
    SENDER_ADDRESS,
    EmailDeliveryError,
    OutgoingEmail,
    SesEmailSender,
    SmtpEmailSender,
    build_email_sender,
)
from app.core.config import Settings

MAILPIT_URL_VARIABLE = "ALETHEIA_TEST_MAILPIT_URL"


def _mailpit_url() -> str:
    return os.environ.get(MAILPIT_URL_VARIABLE, "http://127.0.0.1:8025")


def _recipient() -> str:
    # Un destinatario distinto por prueba: así se encuentra su correo aunque Mailpit guarde otros.
    return f"{uuid.uuid7()}@example.com"


def _delivered(recipient: str) -> dict[str, Any]:
    """Espera hasta 5 segundos el correo en Mailpit y devuelve su contenido completo."""
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        found = httpx2.get(
            f"{_mailpit_url()}/api/v1/search", params={"query": f"to:{recipient}"}, timeout=5
        ).json()
        if found["messages"]:
            message_id = found["messages"][0]["ID"]
            message: dict[str, Any] = httpx2.get(
                f"{_mailpit_url()}/api/v1/message/{message_id}", timeout=5
            ).json()
            return message
        time.sleep(0.1)
    pytest.fail(f"El correo no llegó a Mailpit ({_mailpit_url()}).")


# --- Mensaje ----------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("to", "subject"),
    [
        ("abogada@example.com\r\nBcc: intruso@example.com", "Asunto"),
        ("abogada@example.com", "Asunto\nBcc: intruso@example.com"),
    ],
)
def test_una_cabecera_no_admite_saltos_de_linea(to: str, subject: str) -> None:
    with pytest.raises(ValueError, match="saltos de línea"):
        OutgoingEmail(to=to, subject=subject, text="Texto")


@pytest.mark.parametrize("to", ["abogada", "@example.com", "abogada@", "a@b@example.com"])
def test_el_destinatario_debe_ser_un_correo(to: str) -> None:
    with pytest.raises(ValueError, match="no es una dirección"):
        OutgoingEmail(to=to, subject="Asunto", text="Texto")


# --- Mailpit ----------------------------------------------------------------------------


def test_mailpit_recibe_el_correo_con_remitente_y_respuesta(settings: Settings) -> None:
    recipient = _recipient()
    SmtpEmailSender(settings.smtp_host, settings.smtp_port).send(
        OutgoingEmail(
            to=recipient,
            subject="Verifica tu correo en ALETHEIA",
            text="Abre el enlace para verificar tu correo.",
            html="<p>Abre el enlace para verificar tu correo.</p>",
        )
    )

    message = _delivered(recipient)
    assert message["From"] == {"Name": "ALETHEIA", "Address": SENDER_ADDRESS}
    assert [address["Address"] for address in message["ReplyTo"]] == [REPLY_TO]
    assert message["Subject"] == "Verifica tu correo en ALETHEIA"
    assert message["Text"].strip() == "Abre el enlace para verificar tu correo."
    assert "<p>Abre el enlace" in message["HTML"]
    assert message["MessageID"].endswith("@aletheia.sbs")


def test_un_correo_solo_de_texto_no_lleva_html(settings: Settings) -> None:
    recipient = _recipient()
    SmtpEmailSender(settings.smtp_host, settings.smtp_port).send(
        OutgoingEmail(to=recipient, subject="Aviso", text="Tildes y eñes: ñandú, acción.")
    )

    message = _delivered(recipient)
    assert message["Text"].strip() == "Tildes y eñes: ñandú, acción."
    assert message["HTML"] == ""


def test_sin_servidor_smtp_el_error_se_puede_reintentar() -> None:
    # Puerto 9 (discard): nadie escucha en el equipo, la conexión se rechaza al instante.
    sender = SmtpEmailSender("127.0.0.1", 9)

    with pytest.raises(EmailDeliveryError) as excinfo:
        sender.send(OutgoingEmail(to=_recipient(), subject="Aviso", text="Texto"))

    assert excinfo.value.permanent is False


# --- Amazon SES -------------------------------------------------------------------------


@pytest.fixture
def ses() -> Iterator[tuple[SesEmailSender, Stubber]]:
    client = boto3.client(
        "sesv2",
        region_name="us-east-2",
        aws_access_key_id="prueba",
        aws_secret_access_key="prueba",  # noqa: S106
    )
    with Stubber(client) as stub:
        yield SesEmailSender(client), stub
        stub.assert_no_pending_responses()


def test_ses_recibe_remitente_respuesta_y_ambos_formatos(
    ses: tuple[SesEmailSender, Stubber],
) -> None:
    sender, stub = ses
    stub.add_response(
        "send_email",
        {"MessageId": "0100018f-prueba"},
        {
            "FromEmailAddress": SENDER,
            "Destination": {"ToAddresses": ["abogada@example.com"]},
            "ReplyToAddresses": [REPLY_TO],
            "Content": {
                "Simple": {
                    "Subject": {"Data": "Aviso", "Charset": "UTF-8"},
                    "Body": {
                        "Text": {"Data": "Texto", "Charset": "UTF-8"},
                        "Html": {"Data": "<p>Texto</p>", "Charset": "UTF-8"},
                    },
                }
            },
        },
    )

    sender.send(
        OutgoingEmail(to="abogada@example.com", subject="Aviso", text="Texto", html="<p>Texto</p>")
    )


@pytest.mark.parametrize(
    ("code", "permanent"),
    [
        ("MessageRejected", True),
        ("BadRequestException", True),
        ("TooManyRequestsException", False),
        ("SendingPausedException", False),
    ],
)
def test_ses_distingue_errores_permanentes_y_pasajeros(
    ses: tuple[SesEmailSender, Stubber], code: str, permanent: bool
) -> None:
    sender, stub = ses
    stub.add_client_error("send_email", service_error_code=code, http_status_code=400)

    with pytest.raises(EmailDeliveryError) as excinfo:
        sender.send(OutgoingEmail(to="abogada@example.com", subject="Aviso", text="Texto"))

    assert excinfo.value.permanent is permanent
    assert code in str(excinfo.value)
    assert "abogada@example.com" not in str(excinfo.value)


# --- Elección del adaptador -------------------------------------------------------------


@pytest.mark.parametrize("environment", ["development", "test"])
def test_fuera_de_produccion_el_correo_va_a_mailpit(environment: str) -> None:
    settings = Settings.model_validate(
        {
            "environment": environment,
            "log_level": "INFO",
            "database_url": "postgresql+psycopg://aletheia:clave@localhost:5432/aletheia",
        }
    )
    assert isinstance(build_email_sender(settings), SmtpEmailSender)


def test_en_produccion_el_correo_sale_por_ses(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings.model_validate(
        {
            # Cada campo explícito: un backend/.env con DEBUG no debe colarse en la prueba.
            "environment": "production",
            "log_level": "INFO",
            "database_url": "postgresql+psycopg://aletheia_app@postgres:5432/aletheia",
            "database_password_parameter": "/aletheia/prod/postgres/app-password",
            "token_signing_key_parameter": "/aletheia/prod/app/token-signing-key",
            # La clave de firma de backend/.env tampoco: en producción viene de Parameter Store.
            "token_signing_key": None,
        }
    )
    client = boto3.client("sesv2", region_name="us-east-2")
    monkeypatch.setattr(email_adapter, "ses_client", lambda: client)

    assert isinstance(build_email_sender(settings), SesEmailSender)
