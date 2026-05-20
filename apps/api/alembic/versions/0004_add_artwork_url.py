"""add artwork_url to songs

Revision ID: 0004_add_artwork_url
Revises: 0003_add_conjugated_translation
Create Date: 2026-05-20
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_add_artwork_url"
down_revision = "0003_add_conjugated_translation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "songs",
        sa.Column("artwork_url", sa.String(length=1024), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("songs", "artwork_url")
