"""add avatar_url to users

Revision ID: 0005_add_user_avatar_url
Revises: 0004_add_artwork_url
Create Date: 2026-05-20
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_add_user_avatar_url"
down_revision = "0004_add_artwork_url"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("avatar_url", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
