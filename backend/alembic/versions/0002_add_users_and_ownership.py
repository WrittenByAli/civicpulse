"""add users table and complaint ownership

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-26 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("hashed_password", sa.String(200), nullable=False),
        sa.Column("role", sa.String(10), nullable=False, server_default="citizen"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.add_column(
        "complaints",
        sa.Column(
            "owner_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_complaints_owner_id", "complaints", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_complaints_owner_id", table_name="complaints")
    op.drop_column("complaints", "owner_id")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
