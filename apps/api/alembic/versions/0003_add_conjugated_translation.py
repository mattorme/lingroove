"""add conjugated_translation to vocabulary_entries

Revision ID: 0003_add_conjugated_translation
Revises: 0002_add_password_hash
Create Date: 2026-05-20
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_add_conjugated_translation"
down_revision = "0002_add_password_hash"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "vocabulary_entries",
        sa.Column("conjugated_translation", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("vocabulary_entries", "conjugated_translation")
