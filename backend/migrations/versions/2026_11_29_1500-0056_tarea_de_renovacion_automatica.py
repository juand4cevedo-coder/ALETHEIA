"""tarea de cobro de la renovación automática

Una tarea nueva, `renewal_charge`, cobra la renovación a la fuente de pago vinculada un día antes
de que venza el plan, y la reintenta si el cobro no entra.

Revision ID: 0056
Revises: 0055
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0056"
down_revision: str | Sequence[str] | None = "0055"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_KINDS_BEFORE = (
    "tsa_stamp",
    "export_build",
    "email_send",
    "case_purge",
    "payment_reconcile",
    "export_expire",
    "audit_anonymize",
    "subscription_expire",
    "custody_anchor",
)


def _values(values: tuple[str, ...]) -> str:
    return "kind IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def upgrade() -> None:
    op.drop_constraint(op.f("ck_jobs_kind"), "jobs", type_="check")
    op.create_check_constraint(
        op.f("ck_jobs_kind"), "jobs", _values((*_KINDS_BEFORE, "renewal_charge"))
    )


def downgrade() -> None:
    op.execute("DELETE FROM jobs WHERE kind = 'renewal_charge'")
    op.drop_constraint(op.f("ck_jobs_kind"), "jobs", type_="check")
    op.create_check_constraint(op.f("ck_jobs_kind"), "jobs", _values(_KINDS_BEFORE))
