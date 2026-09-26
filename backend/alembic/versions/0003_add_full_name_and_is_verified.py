"""add full_name and is_verified to users

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-26 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("full_name", sa.String(100), nullable=True))
    op.add_column(
        "users",
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="true"),
    )
    # Backfill existing rows so they are not locked out
    op.execute("UPDATE users SET is_verified = true WHERE is_verified IS NULL OR is_verified = false")


def downgrade() -> None:
    op.drop_column("users", "is_verified")
    op.drop_column("users", "full_name")
