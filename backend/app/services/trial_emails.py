"""Correos del ciclo de la prueba gratuita, al responsable del despacho.

Cinco correos, cada uno con una sola cosa por hacer: abrir el primer caso (día 0), subir una
evidencia (día 3), invitar al equipo (día 7), el aviso de que la prueba termina (día 11) y el de
que terminó (día 14). Solo los reciben los despachos que siguen en prueba y nunca han pagado.

Cada correo mira lo que el despacho ya hizo al momento de salir: si no ha abierto un caso, el del
día 3 se lo pide antes que la evidencia; si ya subió evidencia, le propone exportar el paquete;
si ya invitó a su equipo, el del día 7 le muestra el portal del cliente; y el aviso de que
termina cuenta lo que guardó.

El trabajador los revisa en su mantenimiento (`dispatch`). Cada etapa se anota en trial_emails
antes de encolar el correo, y la llave primaria de esa tabla impide anotarla dos veces: el mismo
correo nunca sale dos veces a la misma organización, aunque el mantenimiento se repita o corra
en dos trabajadores a la vez. Si el trabajador estuvo detenido y se acumularon varias etapas,
solo sale la más reciente; las anteriores se anotan como pasadas sin enviar.

Las horas son las de Bogotá: los avisos de los días 3, 7 y 11 salen a las 9 de la mañana, y la
bienvenida y el cierre, en cuanto corresponden si es entre las 8 de la mañana y las 8 de la
noche, o a las 8 de la mañana siguiente si no.
"""

import datetime
import html
import uuid
from dataclasses import dataclass
from typing import Any, Final
from zoneinfo import ZoneInfo

from sqlalchemy import exists, func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.adapters.email import REPLY_TO, OutgoingEmail
from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import (
    Case,
    Evidence,
    Export,
    Invitation,
    Membership,
    Organization,
    PaymentReceipt,
    Plan,
    Subscription,
    TrialEmail,
    User,
)
from app.services import jobs
from app.services.email_layout import email_layout
from app.services.jobs import PermanentJobError
from app.services.notifications import email_template
from app.services.organization_emails import colombian_datetime

BOGOTA: Final = ZoneInfo("America/Bogota")
TEMPLATE: Final = "trial_lifecycle"
STAGES: Final = ("day_0", "day_3", "day_7", "day_11", "day_14")
# Días desde que empezó la prueba para los avisos intermedios, y cuántos antes del final va el
# aviso de que termina.
_DAY_OFFSETS: Final = {"day_3": 3, "day_7": 7}
_ENDING_NOTICE_DAYS: Final = 3
_NOTICE_HOUR: Final = 9
_DAY_STARTS: Final = 8
_DAY_ENDS: Final = 20
# Días que la cuenta queda en solo lectura al terminar la prueba (política de reembolsos).
READ_ONLY_DAYS: Final = 30
_MONTHS: Final = (
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
)


@dataclass(frozen=True, slots=True)
class Candidate:
    """Un despacho en prueba, sin pagos, con su responsable y lo que ya recibió."""

    organization_id: uuid.UUID
    owner_id: uuid.UUID
    started_at: datetime.datetime
    trial_ends_at: datetime.datetime
    sent: frozenset[str]


def colombian_date(moment: datetime.datetime) -> str:
    """El día de Colombia en palabras, por ejemplo «24 de noviembre de 2026»."""
    local = moment.astimezone(BOGOTA)
    return f"{local.day} de {_MONTHS[local.month - 1]} de {local.year}"


def _at_notice_hour(day: datetime.date) -> datetime.datetime:
    return datetime.datetime.combine(day, datetime.time(_NOTICE_HOUR), tzinfo=BOGOTA)


def _in_waking_hours(moment: datetime.datetime) -> datetime.datetime:
    """El mismo momento si cae de día en Bogotá; si no, las 8 de la mañana siguientes."""
    local = moment.astimezone(BOGOTA)
    if _DAY_STARTS <= local.hour < _DAY_ENDS:
        return moment
    day = local.date() if local.hour < _DAY_STARTS else local.date() + datetime.timedelta(days=1)
    return datetime.datetime.combine(day, datetime.time(_DAY_STARTS), tzinfo=BOGOTA)


def due_at(
    stage: str, started_at: datetime.datetime, ends_at: datetime.datetime
) -> datetime.datetime:
    """Cuándo le toca a una etapa, en hora de Bogotá."""
    if stage == "day_0":
        return _in_waking_hours(started_at)
    if stage == "day_14":
        return _in_waking_hours(ends_at)
    if stage == "day_11":
        day = ends_at.astimezone(BOGOTA).date() - datetime.timedelta(days=_ENDING_NOTICE_DAYS)
        return _at_notice_hour(day)
    day = started_at.astimezone(BOGOTA).date() + datetime.timedelta(days=_DAY_OFFSETS[stage])
    return _at_notice_hour(day)


def due_stages(candidate: Candidate, now: datetime.datetime) -> list[str]:
    """Las etapas que ya llegaron y no se han anotado, en orden. Mientras la prueba sigue, el
    cierre no ha llegado; cuando terminó, los avisos anteriores ya no tienen sentido."""
    ended = now >= candidate.trial_ends_at
    due: list[str] = []
    for stage in STAGES:
        if stage in candidate.sent:
            continue
        if (stage == "day_14") != ended:
            continue
        if due_at(stage, candidate.started_at, candidate.trial_ends_at) <= now:
            due.append(stage)
    return due


def candidates(session: Session) -> list[Candidate]:
    """Los despachos en prueba sin pagos (función de la migración 0064)."""
    rows = session.execute(
        text(
            "SELECT organization_id, owner_id, started_at, trial_ends_at, sent "
            "FROM trial_email_candidates()"
        )
    ).all()
    return [
        Candidate(
            organization_id=row.organization_id,
            owner_id=row.owner_id,
            started_at=row.started_at,
            trial_ends_at=row.trial_ends_at,
            sent=frozenset(row.sent or ()),
        )
        for row in rows
    ]


def dispatch(session: Session, now: datetime.datetime) -> int:
    """Anota y encola los correos que tocan. Devuelve cuántos encoló. Repetirlo no duplica."""
    queued = 0
    for candidate in candidates(session):
        due = due_stages(candidate, now)
        if not due:
            continue
        latest = due[-1]
        set_tenant(session, TenantContext(organization_id=candidate.organization_id))
        noted = session.scalars(
            insert(TrialEmail)
            .values(
                [
                    {
                        "organization_id": candidate.organization_id,
                        "stage": stage,
                        "emailed": stage == latest,
                    }
                    for stage in due
                ]
            )
            .on_conflict_do_nothing(index_elements=["organization_id", "stage"])
            .returning(TrialEmail.stage)
        ).all()
        if latest in noted:
            jobs.enqueue(
                session,
                "email_send",
                {
                    "template": TEMPLATE,
                    "organization_id": str(candidate.organization_id),
                    "user_id": str(candidate.owner_id),
                    "stage": latest,
                },
                f"{TEMPLATE}:{candidate.organization_id}:{latest}",
            )
            queued += 1
    set_tenant(session, TenantContext())
    return queued


def _still_in_trial(
    session: Session, organization_id: uuid.UUID, stage: str
) -> Subscription | None:
    """La suscripción si el despacho sigue en prueba sin pagar; si no, el correo ya sobra."""
    subscription = session.scalar(
        select(Subscription).where(Subscription.organization_id == organization_id)
    )
    if subscription is None or subscription.access_source != "trial":
        return None
    allowed = ("trial", "expired") if stage == "day_14" else ("trial",)
    if subscription.status not in allowed or subscription.trial_ends_at is None:
        return None
    paid = session.scalar(select(exists().where(PaymentReceipt.organization_id == organization_id)))
    return None if paid else subscription


@email_template(TEMPLATE)
def trial_email(
    session: Session, payload: dict[str, Any], settings: Settings
) -> OutgoingEmail | None:
    try:
        organization_id = uuid.UUID(str(payload["organization_id"]))
        user_id = uuid.UUID(str(payload["user_id"]))
        stage = str(payload["stage"])
    except KeyError, ValueError:
        msg = "La tarea de correo de la prueba no trae datos válidos."
        raise PermanentJobError(msg) from None
    if stage not in STAGES:
        msg = "La tarea de correo de la prueba trae una etapa desconocida."
        raise PermanentJobError(msg)
    set_tenant(session, TenantContext(organization_id=organization_id))
    user = session.get(User, user_id)
    organization = session.get(Organization, organization_id)
    if user is None or user.status != "active" or organization is None:
        return None
    subscription = _still_in_trial(session, organization_id, stage)
    if subscription is None or subscription.trial_ends_at is None:
        return None
    plan = session.get(Plan, subscription.plan_id)
    included = plan.included_users if plan is not None else 1
    content = _CONTENT[stage](
        subscription.trial_ends_at, included, activity(session, organization_id)
    )
    url = f"{settings.public_url}{content.path}"
    name = user.full_name
    closing = f"Si tiene alguna duda, escríbanos a {REPLY_TO} y le respondemos."
    return OutgoingEmail(
        to=user.email,
        subject=content.subject,
        text=(
            f"Hola, {name}:\n\n"
            + "".join(f"{paragraph}\n\n" for paragraph in content.paragraphs)
            + f"{content.action}: {url}\n\n{closing}\n\nALETHEIA"
        ),
        html=email_layout(
            f"Hola, {html.escape(name)}:",
            [html.escape(paragraph) for paragraph in content.paragraphs],
            (content.action, url),
            html.escape(closing),
            site_url=settings.public_url,
        ),
    )


@dataclass(frozen=True, slots=True)
class Activity:
    """Lo que el despacho ya hizo en la prueba, contado al momento de armar el correo."""

    cases: int
    evidences: int
    people: int
    exports: int


def activity(session: Session, organization_id: uuid.UUID) -> Activity:
    """Cuenta casos, evidencias, personas (miembros e invitaciones abiertas) y paquetes. La
    seguridad por filas ya limita cada tabla al despacho del contexto."""

    def count(model: Any) -> int:
        return (
            session.scalar(
                select(func.count())
                .select_from(model)
                .where(model.organization_id == organization_id)
            )
            or 0
        )

    open_invitations = (
        session.scalar(
            select(func.count())
            .select_from(Invitation)
            .where(
                Invitation.organization_id == organization_id,
                Invitation.accepted_at.is_(None),
                Invitation.revoked_at.is_(None),
                Invitation.expires_at > func.now(),
            )
        )
        or 0
    )
    return Activity(
        cases=count(Case),
        evidences=count(Evidence),
        people=count(Membership) + open_invitations,
        exports=count(Export),
    )


def _plural(amount: int, one: str, many: str) -> str:
    return f"{amount} {one if amount == 1 else many}"


@dataclass(frozen=True, slots=True)
class _Content:
    subject: str
    paragraphs: tuple[str, ...]
    action: str
    path: str


def _welcome(ends_at: datetime.datetime, included: int, done: Activity) -> _Content:
    return _Content(
        subject="Su prueba de ALETHEIA ya empezó",
        paragraphs=(
            f"Su prueba gratuita está activa hasta el {colombian_datetime(ends_at)} (hora de "
            "Colombia). No pidió tarjeta y no se le va a cobrar nada al terminar.",
            "Para empezar, abra su primer caso. Ahí quedan juntas las evidencias, las tareas y "
            "las notas de ese asunto, y solo lo ven las personas asignadas a él.",
        ),
        action="Abrir mi primer caso",
        path="/app/casos/nuevo",
    )


def _evidence(ends_at: datetime.datetime, included: int, done: Activity) -> _Content:
    if done.cases == 0:
        return _Content(
            subject="Abra su primer caso en ALETHEIA",
            paragraphs=(
                "Todavía no ha abierto un caso. Tome uno real, aunque sea pequeño: el nombre, el "
                "radicado si lo tiene y el despacho judicial bastan para empezar.",
                "Después suba un archivo que le haya mandado el cliente. ALETHEIA calcula su "
                "huella SHA-256 y le pide un sello de tiempo RFC 3161 a DigiCert, con Sectigo de "
                "respaldo. Así ve en un minuto lo que el producto hace con su evidencia.",
            ),
            action="Abrir mi primer caso",
            path="/app/casos/nuevo",
        )
    if done.evidences > 0:
        return _Content(
            subject="Exporte el paquete de su caso y compruébelo usted mismo",
            paragraphs=(
                f"Ya guardó {_plural(done.evidences, 'evidencia', 'evidencias')} con su huella y "
                "su sello de tiempo. El paso siguiente es ver lo que recibiría otra persona: "
                "en el caso, pida el paquete de preservación.",
                "Es un ZIP con los originales, el manifiesto de huellas, la cadena de custodia, "
                "los sellos y un informe en PDF. Ábralo en el comprobador público con el "
                "manifest.json y uno de los archivos, y vea que las huellas coinciden.",
            ),
            action="Abrir mis casos",
            path="/app/casos",
        )
    return _Content(
        subject="Suba una evidencia y vea su huella y su sello de tiempo",
        paragraphs=(
            "Entre a un caso y suba un archivo: un chat exportado, una foto, un correo o un PDF. "
            "ALETHEIA calcula su huella SHA-256, que cambia si el archivo cambia en un solo "
            "byte, así que después puede comprobar que sigue siendo el mismo que subió.",
            "También le pedimos un sello de tiempo RFC 3161 a un servicio público de sellado "
            "(DigiCert, con Sectigo de respaldo), que registra la fecha y la hora en que el "
            "archivo existía con esa huella. Los dos datos quedan en la ficha de la evidencia.",
        ),
        action="Subir una evidencia",
        path="/app/casos",
    )


def _team(ends_at: datetime.datetime, included: int, done: Activity) -> _Content:
    if done.people > 1:
        return _Content(
            subject="Comparta el estado del caso con su cliente",
            paragraphs=(
                f"Su despacho ya tiene {_plural(done.people, 'persona', 'personas')} en "
                "ALETHEIA. Falta alguien que siempre pregunta cómo va el caso: el cliente.",
                "Desde el caso, invítelo al portal del cliente. Entra con un enlace, sin crear "
                "cuenta, y ve el estado del caso, los avisos que usted publique y los documentos "
                "que le comparta. No ve la evidencia ni nada más del despacho.",
            ),
            action="Abrir mis casos",
            path="/app/casos",
        )
    others = included - 1
    people = "otra persona" if others == 1 else f"otras {others} personas"
    return _Content(
        subject="Invite a su equipo a ALETHEIA",
        paragraphs=(
            f"Su prueba incluye {included} usuarios: usted y {people}. Puede invitar a un "
            "abogado, a un asistente o a alguien que le ayude a administrar el equipo. Cada uno "
            "entra con su propio correo y su contraseña.",
            "Cada persona ve solo los casos a los que la asignen. Un asistente puede subir "
            "evidencia y escribir notas, pero no descargar archivos ni crear casos.",
        ),
        action="Invitar a mi equipo",
        path="/app/miembros",
    )


def _ending(ends_at: datetime.datetime, included: int, done: Activity) -> _Content:
    return _Content(
        subject=f"Su prueba de ALETHEIA termina el {colombian_date(ends_at)}",
        paragraphs=(
            f"Su prueba gratuita termina el {colombian_datetime(ends_at)} (hora de Colombia).",
            *(
                (
                    f"En estos días abrió {_plural(done.cases, 'caso', 'casos')} y guardó "
                    f"{_plural(done.evidences, 'evidencia', 'evidencias')} con su huella y su "
                    "sello de tiempo. Todo eso sigue ahí si elige un plan.",
                )
                if done.cases > 0
                else ()
            ),
            "Para seguir trabajando igual, elija un plan en Plan y facturación. Si no elige "
            f"ninguno, el despacho pasa a solo lectura durante {READ_ONLY_DAYS} días: podrá "
            "consultar sus casos y descargar sus archivos, pero no abrir casos nuevos ni subir "
            "evidencia.",
        ),
        action="Elegir un plan",
        path="/app/facturacion",
    )


def _ended(ends_at: datetime.datetime, included: int, done: Activity) -> _Content:
    return _Content(
        subject="Su prueba de ALETHEIA terminó",
        paragraphs=(
            f"Su prueba gratuita terminó el {colombian_date(ends_at)}. Sus casos siguen "
            f"disponibles {READ_ONLY_DAYS} días en solo lectura: puede consultarlos y descargar "
            "sus archivos.",
            "Si elige un plan, vuelve a abrir casos y a subir evidencia con todo lo que ya "
            "guardó en su lugar.",
        ),
        action="Elegir un plan",
        path="/app/facturacion",
    )


_CONTENT: Final = {
    "day_0": _welcome,
    "day_3": _evidence,
    "day_7": _team,
    "day_11": _ending,
    "day_14": _ended,
}
