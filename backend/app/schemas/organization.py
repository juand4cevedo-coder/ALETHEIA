"""Esquemas de los miembros y las invitaciones de la organización (API-015 a API-018)."""

import datetime
import uuid
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Email
from app.schemas.me import MemberRole

# Los mismos roles de invitations.role: el propietario no se invita, nace con la organización.
InvitableRole = Literal["admin", "lawyer", "assistant"]


class OrganizationAuditAction(StrEnum):
    """Acciones de seguridad que un gestor puede consultar explícitamente."""

    USER_REGISTERED = "user_registered"
    EMAIL_VERIFIED = "email_verified"
    LOGIN = "login"
    LOGIN_FAILED = "login_failed"
    GOOGLE_LINKED = "google_linked"
    SESSION_REUSE_DETECTED = "session_reuse_detected"
    SESSIONS_REVOKED = "sessions_revoked"
    PASSWORD_RESET = "password_reset"  # noqa: S105 -- nombre de evento, no una clave
    PASSWORD_CHANGED = "password_changed"  # noqa: S105 -- nombre de evento, no una clave
    INVITATION_SENT = "invitation_sent"
    INVITATION_REVOKED = "invitation_revoked"
    INVITATION_ACCEPTED = "invitation_accepted"
    ROLE_CHANGED = "role_changed"
    MEMBER_REMOVED = "member_removed"
    PLAN_CHANGED = "plan_changed"
    SUBSCRIPTION_CANCELED = "subscription_canceled"
    SUBSCRIPTION_EXPIRED = "subscription_expired"
    COURTESY_GRANTED = "courtesy_granted"
    COURTESY_RENEWED = "courtesy_renewed"
    COURTESY_REVOKED = "courtesy_revoked"
    ACCOUNT_BLOCKED = "account_blocked"
    ACCOUNT_UNBLOCKED = "account_unblocked"
    ACCOUNT_CLOSED = "account_closed"
    LEGAL_ACCEPTED = "legal_accepted"
    LOGOUT = "logout"


# Tamaño de página por defecto y máximo de las listas paginadas por cursor.
PAGE_SIZE_DEFAULT = 50
PAGE_SIZE_MAX = 100


class InvitationRequest(BaseModel):
    """Correo y rol de la persona invitada (API-016)."""

    model_config = ConfigDict(extra="forbid")

    email: Email = Field(description="Correo al que llega la invitación.")
    role: InvitableRole = Field(description="Rol con que entrará: admin, lawyer o assistant.")


class OrganizationRenameRequest(BaseModel):
    """Nombre nuevo del despacho (API-022). Solo el propietario lo cambia."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        min_length=1,
        max_length=120,
        description="Nombre de la oficina, la firma o la persona independiente.",
    )


class OrganizationOut(BaseModel):
    """Los datos propios del despacho que puede administrar su propietario."""

    id: uuid.UUID = Field(description="Identificador de la organización.")
    name: str = Field(description="Nombre de la oficina, la firma o la persona independiente.")
    created_at: datetime.datetime = Field(description="Cuándo se creó la organización.")


class RoleChangeRequest(BaseModel):
    """El rol nuevo de un miembro (API-020). El propietario no se asigna: nace con la
    organización (RN-010)."""

    model_config = ConfigDict(extra="forbid")

    role: InvitableRole = Field(description="Rol nuevo: admin, lawyer o assistant.")


class InvitationOut(BaseModel):
    """Una invitación sin aceptar ni revocar."""

    id: uuid.UUID = Field(description="Identificador de la invitación.")
    email: str = Field(description="Correo invitado.")
    role: InvitableRole = Field(description="Rol ofrecido.")
    invited_at: datetime.datetime = Field(description="Cuándo se envió.")
    expires_at: datetime.datetime = Field(description="Cuándo vence: 72 horas después.")
    expired: bool = Field(description="Si ya venció sin que la aceptaran.")


class InvitationPage(BaseModel):
    """Invitaciones pendientes, de la más reciente a la más antigua (API-017)."""

    items: list[InvitationOut] = Field(description="Invitaciones de esta página.")
    next_cursor: uuid.UUID | None = Field(
        description="Cursor para la página siguiente, o null si no hay más."
    )


class MemberOut(BaseModel):
    """Una persona de la organización y su rol."""

    user_id: uuid.UUID = Field(description="Identificador de la persona.")
    full_name: str = Field(description="Nombre de la persona.")
    email: str = Field(description="Correo de la persona.")
    role: MemberRole = Field(description="Rol en la organización.")
    joined_at: datetime.datetime = Field(description="Cuándo entró a la organización.")


class SeatsOut(BaseModel):
    """Cupo de usuarios del plan (RN-012)."""

    used: int = Field(description="Miembros más invitaciones abiertas.")
    included: int = Field(description="Usuarios que incluye el plan.")
    extra_user_price_cop: int | None = Field(
        description="Precio mensual de cada usuario adicional, o null si el plan no los admite."
    )
    full: bool = Field(description="Si ya no cabe nadie más sin cambiar de plan.")
    owner_exempt: bool = Field(
        description="El propietario de la plataforma puede invitar sin tope del plan."
    )


class MemberPage(BaseModel):
    """Miembros en el orden en que llegaron, con el cupo del plan (API-015)."""

    items: list[MemberOut] = Field(description="Miembros de esta página.")
    next_cursor: uuid.UUID | None = Field(
        description="Cursor para la página siguiente, o null si no hay más."
    )
    seats: SeatsOut = Field(description="Cupo de usuarios del plan.")


class OrganizationAuditEvent(BaseModel):
    """Evento de seguridad del despacho, sin contenido de casos ni datos internos."""

    id: uuid.UUID
    action: str
    actor_user_id: uuid.UUID | None
    target_id: uuid.UUID | None
    ip: str | None
    user_agent: str | None
    created_at: datetime.datetime


class OrganizationAuditPage(BaseModel):
    items: list[OrganizationAuditEvent]
    next_cursor: uuid.UUID | None


class SecurityIndicators(BaseModel):
    """Conteos de eventos de seguridad de la ventana de la respuesta."""

    logins: int
    failed_logins: int
    sessions_revoked: int
    role_changes: int
    invitations: int


class OrganizationHealth(BaseModel):
    """Salud del despacho para quien lo gestiona (HU de métricas)."""

    storage_used_bytes: int
    storage_limit_bytes: int | None = Field(description="Null si la organización no tiene plan.")
    plan_name: str | None
    subscription_status: str | None
    subscription_ends_at: datetime.datetime | None = Field(
        description="Fin de la prueba, del periodo vigente o de la lectura posterior a cancelar."
    )
    members: int
    seats_included: int
    seats_used: int = Field(description="Miembros más invitaciones abiertas.")
    window_days: int
    security: SecurityIndicators
