"""Modelos de ALETHEIA. Importar este paquete registra todas las tablas en Base.metadata."""

from app.db.base import Base
from app.models import custody_hooks as _custody_hooks  # noqa: F401
from app.models.billing import (
    PaymentEvent,
    PaymentReceipt,
    PaymentSource,
    Plan,
    Subscription,
    TrialEmail,
)
from app.models.client_portal import (
    ClientPortalAccess,
    ClientPortalDocument,
    ClientPortalMessage,
    ClientPortalUpdate,
)
from app.models.evidence import (
    Case,
    CaseMember,
    CustodyAnchor,
    CustodyEvent,
    DeletionRecord,
    Evidence,
    Export,
)
from app.models.evidence_share_links import EvidenceShareLink
from app.models.identity import AuditLog, LegalAcceptance, OAuthIdentity, RefreshToken, User
from app.models.jobs import Job
from app.models.limits import CaptchaSolution, RateLimitEvent
from app.models.notes import CaseNote
from app.models.organization import Invitation, Membership, Organization
from app.models.support import SupportTicket
from app.models.task_templates import TaskTemplate, TaskTemplateItem
from app.models.tasks import CaseTask
from app.models.two_factor import TwoFactorRecovery, TwoFactorRecoveryCode, UserTwoFactor
from app.models.web_vitals import WebVital

__all__ = [
    "AuditLog",
    "Base",
    "CaptchaSolution",
    "Case",
    "CaseMember",
    "CaseNote",
    "CaseTask",
    "ClientPortalAccess",
    "ClientPortalDocument",
    "ClientPortalMessage",
    "ClientPortalUpdate",
    "CustodyAnchor",
    "CustodyEvent",
    "DeletionRecord",
    "Evidence",
    "EvidenceShareLink",
    "Export",
    "Invitation",
    "Job",
    "LegalAcceptance",
    "Membership",
    "OAuthIdentity",
    "Organization",
    "PaymentEvent",
    "PaymentReceipt",
    "PaymentSource",
    "Plan",
    "RateLimitEvent",
    "RefreshToken",
    "Subscription",
    "SupportTicket",
    "TaskTemplate",
    "TaskTemplateItem",
    "TrialEmail",
    "TwoFactorRecovery",
    "TwoFactorRecoveryCode",
    "User",
    "UserTwoFactor",
    "WebVital",
]
