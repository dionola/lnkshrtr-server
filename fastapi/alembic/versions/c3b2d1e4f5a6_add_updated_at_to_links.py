"""add updated_at to links

Revision ID: c3b2d1e4f5a6
Revises: a9a1059bcb39
Create Date: 2026-02-09 00:00:00.000000

"""
from typing import Sequence, Union
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa

revision: str = 'c3b2d1e4f5a6'
down_revision: Union[str, None] = 'a9a1059bcb39'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('links', sa.Column(
        'updated_at',
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    ))


def downgrade() -> None:
    op.drop_column('links', 'updated_at')
