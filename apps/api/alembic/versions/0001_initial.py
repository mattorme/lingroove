"""initial tables

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-09
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "songs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("artist", sa.String(length=255), nullable=True),
        sa.Column("source_type", sa.String(length=20), nullable=False),
        sa.Column("source_url", sa.String(length=1024), nullable=True),
        sa.Column("external_track_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "lyrics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("song_id", sa.Integer(), sa.ForeignKey("songs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("clean_text", sa.Text(), nullable=False),
        sa.Column("language", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "playlists",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "vocabulary_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("song_id", sa.Integer(), sa.ForeignKey("songs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lyric_id", sa.Integer(), sa.ForeignKey("lyrics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("original_word", sa.String(length=120), nullable=False),
        sa.Column("lemma", sa.String(length=120), nullable=False),
        sa.Column("infinitive_form", sa.String(length=120), nullable=True),
        sa.Column("english_translation", sa.String(length=255), nullable=False),
        sa.Column("context_line", sa.Text(), nullable=False),
        sa.Column("part_of_speech", sa.String(length=20), nullable=False),
        sa.Column("is_selected", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_vocabulary_song_pos",
        "vocabulary_entries",
        ["song_id", "part_of_speech"],
        unique=False,
    )

    op.create_table(
        "playlist_songs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("playlist_id", sa.Integer(), sa.ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False),
        sa.Column("song_id", sa.Integer(), sa.ForeignKey("songs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("added_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("playlist_id", "song_id", name="uq_playlist_song"),
    )


def downgrade() -> None:
    op.drop_table("playlist_songs")
    op.drop_index("ix_vocabulary_song_pos", table_name="vocabulary_entries")
    op.drop_table("vocabulary_entries")
    op.drop_table("playlists")
    op.drop_table("lyrics")
    op.drop_table("songs")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
