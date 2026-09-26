"""create complaints table

Revision ID: 0001
Revises:
Create Date: 2026-09-25 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "complaints",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("text", sa.String(2000), nullable=False),
        sa.Column("location", sa.String(200), nullable=False),
        sa.Column("reporter_contact", sa.String(200), nullable=True),
        sa.Column("category", sa.String(20), nullable=False, server_default="other"),
        sa.Column("priority", sa.String(10), nullable=False, server_default="normal"),
        sa.Column("status", sa.String(15), nullable=False, server_default="open"),
        sa.Column("ai_summary", sa.String(140), nullable=True),
        sa.Column("triaged_by", sa.String(20), nullable=True),
        sa.Column("triage_latency_ms", sa.Integer, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    # Indexes for dashboard filter + pagination queries
    op.create_index("ix_complaints_status", "complaints", ["status"])
    op.create_index("ix_complaints_priority", "complaints", ["priority"])
    op.create_index("ix_complaints_created_at", "complaints", ["created_at"])
    op.create_index(
        "ix_complaints_status_priority",
        "complaints",
        ["status", "priority"],
    )


def downgrade() -> None:
    op.drop_index("ix_complaints_status_priority", table_name="complaints")
    op.drop_index("ix_complaints_created_at", table_name="complaints")
    op.drop_index("ix_complaints_priority", table_name="complaints")
    op.drop_index("ix_complaints_status", table_name="complaints")
    op.drop_table("complaints")
