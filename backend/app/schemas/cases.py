"""Esquemas para abrir un caso, listar los casos y ver su detalle (API-022 a API-024)."""

import datetime
import re
import uuid
from typing import Final, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.me import MemberRole

# Los mismos valores de cases.practice_area.
PracticeArea = Literal[
    "civil",
    "commercial",
    "family",
    "labor",
    "criminal",
    "administrative",
    "constitutional",
    "other",
]

# Los mismos valores de evidences.declared_type.
DeclaredType = Literal["chat", "email", "audio", "image", "document", "other"]
RetentionBasis = Literal["organization_policy", "legal_or_contractual_duty", "litigation_hold"]


class EvidenceUploadOut(BaseModel):
    """Constancia inmediata de la preservación; el sello de tiempo llega después."""

    id: uuid.UUID
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    size_bytes: int = Field(gt=0)
    tsa_status: Literal["pending"]


class EvidenceSummaryOut(BaseModel):
    """Metadatos visibles para quienes pertenecen al caso; sin contenido del archivo."""

    id: uuid.UUID
    original_filename: str
    declared_type: DeclaredType
    declared_origin: str
    detected_type: str
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    size_bytes: int = Field(gt=0)
    tsa_status: Literal["pending", "stamped", "failed"]
    uploaded_at: datetime.datetime


class EvidencePage(BaseModel):
    items: list[EvidenceSummaryOut]
    next_cursor: uuid.UUID | None


# MSG nuevo de la sección 5.3 del diseño: dice cuántos dígitos tiene y cómo revisarlos.
INVALID_FILING_NUMBER: Final = (
    "El número de radicación tiene 23 dígitos. Revise que no falte ni sobre ninguno"
)

_SEPARATORS: Final = re.compile(r"[\s.\-]")
_FILING_NUMBER: Final = re.compile(r"[0-9]{23}")


class CaseCreate(BaseModel):
    """Datos con que se abre un caso (API-022)."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=160, description="Título del caso.")
    filing_number: str | None = Field(
        default=None,
        max_length=64,
        description=(
            "Número de radicación. Se aceptan espacios, puntos y guiones; se guardan solo sus "
            "23 dígitos."
        ),
    )
    court: str | None = Field(
        default=None, min_length=1, max_length=160, description="Despacho que lleva el proceso."
    )
    practice_area: PracticeArea | None = Field(default=None, description="Especialidad.")
    internal_reference: str | None = Field(
        default=None,
        min_length=1,
        max_length=80,
        description="Referencia con que la oficina identifica el caso.",
    )

    @field_validator("filing_number")
    @classmethod
    def _normalize_filing_number(cls, value: str | None) -> str | None:
        if value is None:
            return None
        digits = _SEPARATORS.sub("", value)
        if _FILING_NUMBER.fullmatch(digits) is None:
            raise ValueError(INVALID_FILING_NUMBER)
        return digits


class CaseRetentionUpdate(BaseModel):
    """Fundamento operativo y bloqueo de un expediente archivado."""

    model_config = ConfigDict(extra="forbid")

    legal_hold: bool
    retention_basis: RetentionBasis

    @model_validator(mode="after")
    def _basis_matches_hold(self) -> CaseRetentionUpdate:
        if self.legal_hold != (self.retention_basis == "litigation_hold"):
            raise ValueError(
                "El bloqueo jurídico exige el fundamento de bloqueo por litigio y viceversa."
            )
        return self


class CaseOut(BaseModel):
    """Un caso activo o archivado."""

    id: uuid.UUID = Field(description="Identificador del caso.")
    title: str = Field(description="Título del caso.")
    filing_number: str | None = Field(description="Los 23 dígitos del radicado, si lo tiene.")
    court: str | None = Field(description="Despacho que lleva el proceso.")
    practice_area: PracticeArea | None = Field(description="Especialidad.")
    internal_reference: str | None = Field(description="Referencia interna de la oficina.")
    status: Literal["open", "closed"] = Field(description="Si el caso sigue abierto.")
    created_at: datetime.datetime = Field(description="Cuándo se abrió.")
    closed_at: datetime.datetime | None = Field(description="Cuándo se archivó, si está cerrado.")
    retention_until: datetime.datetime | None = Field(
        description="Fecha mínima para revisar si la conservación debe continuar."
    )
    retention_basis: RetentionBasis | None = Field(
        description="Fundamento operativo de la conservación."
    )
    legal_hold: bool = Field(description="Si existe un bloqueo jurídico que impide suprimir.")
    created_by_name: str = Field(description="Nombre de quien lo abrió.")
    member_count: int = Field(description="Personas asignadas al caso.")


class CaseMemberOut(BaseModel):
    """Una persona asignada al caso."""

    user_id: uuid.UUID = Field(description="Identificador de la persona.")
    full_name: str = Field(description="Nombre de la persona.")
    email: str = Field(description="Correo de la persona.")
    role: MemberRole = Field(description="Rol en la organización.")
    added_at: datetime.datetime = Field(description="Cuándo se asignó al caso.")


class CaseMemberAdd(BaseModel):
    """Persona de la organización que se asignará al caso."""

    model_config = ConfigDict(extra="forbid")
    user_id: uuid.UUID


class CaseCandidate(BaseModel):
    """Persona disponible para asignar a este caso."""

    user_id: uuid.UUID
    full_name: str
    email: str
    role: MemberRole


class CustodyEventOut(BaseModel):
    """Un evento de la cadena de custodia del caso."""

    seq: int = Field(description="Posición del evento en la cadena, desde 1.")
    action: str = Field(description="Qué ocurrió, por ejemplo case_created.")
    actor_name: str | None = Field(description="Quién lo hizo, o null si fue el sistema.")
    occurred_at: datetime.datetime = Field(description="Cuándo ocurrió.")
    event_hash: str = Field(description="Huella SHA-256 del evento, en hexadecimal.")


class CustodyPage(BaseModel):
    """Una página de eventos del caso, del más reciente al más antiguo."""

    items: list[CustodyEventOut]
    next_cursor: int | None = Field(description="Secuencia anterior a la última mostrada.")


class CustodyAnchorOut(BaseModel):
    """Alcance de un anclaje externo, sin exponer su token criptográfico."""

    seq: int = Field(description="Último evento cubierto por el sello externo.")
    head_hash: str = Field(description="Huella de la cabeza sellada, en hexadecimal.")
    tsa_time: datetime.datetime = Field(description="Hora declarada por la autoridad de sellado.")


class CustodyVerificationOut(BaseModel):
    """Resultado del recálculo independiente de la cadena guardada."""

    intact: bool
    events_checked: int
    broken_at: int | None
    reason: Literal["sequence", "previous_hash", "event_hash"] | None
    head_hash: str = Field(description="Huella del último evento válido, en hexadecimal.")
    latest_anchor: CustodyAnchorOut | None = Field(
        description="Última cabeza con sello externo, o null si todavía no existe."
    )


class EvidenceDetailOut(EvidenceSummaryOut):
    """Metadatos y eventos de una evidencia asignada, sin contenido ni token del sello."""

    tsa_time: datetime.datetime | None
    events: list[CustodyEventOut]
    next_event_seq: int | None


class CaseDetail(CaseOut):
    """El caso con su equipo y sus últimos eventos (API-024)."""

    members: list[CaseMemberOut] = Field(description="Equipo del caso.")
    recent_events: list[CustodyEventOut] = Field(
        description="Últimos eventos de la cadena, del más reciente al más antiguo."
    )


class LastEventOut(BaseModel):
    """El último evento de la cadena de un caso."""

    action: str = Field(description="Qué ocurrió, por ejemplo evidence_uploaded.")
    actor_name: str | None = Field(description="Quién lo hizo, o null si fue el sistema.")
    occurred_at: datetime.datetime = Field(description="Cuándo ocurrió.")


class CaseSummaryOut(CaseOut):
    """Un caso de la lista con su actividad (API-023)."""

    evidence_count: int = Field(description="Evidencias del caso.")
    evidence_by_type: dict[DeclaredType, int] = Field(
        description="Evidencias por tipo declarado; solo los tipos que tienen alguna."
    )
    member_initials: list[str] = Field(
        description="Iniciales de las tres primeras personas en llegar al caso.", max_length=3
    )
    last_event: LastEventOut | None = Field(
        description="Último evento de la cadena; null solo si el caso no tiene eventos."
    )
    recent_actions: list[str] = Field(
        description="Acciones de los últimos cinco eventos, el más reciente al final.",
        max_length=5,
    )
    last_activity_at: datetime.datetime = Field(
        description="Hora del último evento de la cadena; por ella se ordena la lista."
    )


class CaseTotalsOut(BaseModel):
    """Totales de los casos donde la persona es miembro, sin importar el filtro."""

    open: int = Field(description="Casos abiertos.")
    closed: int = Field(description="Casos cerrados.")
    evidences: int = Field(description="Evidencias en esos casos.")
    pending_stamps: int = Field(description="Evidencias cuyo sello de tiempo está pendiente.")
    custody_events: int = Field(description="Eventos de custodia de esos casos.")


class CasePage(BaseModel):
    """Una página de los casos de la persona y los totales (API-023)."""

    items: list[CaseSummaryOut] = Field(
        description="Casos de la actividad más reciente a la más antigua."
    )
    next_cursor: str | None = Field(description="Cursor de la página siguiente, o null.")
    totals: CaseTotalsOut = Field(description="Totales de los casos de la persona.")
