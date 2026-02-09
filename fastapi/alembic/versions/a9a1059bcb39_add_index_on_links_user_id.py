"""add index on links.user_id

Revision ID: a9a1059bcb39
Revises: a00540ef4f36
Create Date: 2026-01-15 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'a9a1059bcb39'
down_revision: Union[str, None] = 'a00540ef4f36'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('ix_links_user_id', 'links', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_links_user_id', table_name='links')
