from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Song(Base):
    __tablename__ = "songs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    artist: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_type: Mapped[str] = mapped_column(String(20))
    source_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    external_track_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    lyrics: Mapped[list["Lyric"]] = relationship(back_populates="song", cascade="all, delete-orphan")
    vocabulary_entries: Mapped[list["VocabularyEntry"]] = relationship(
        back_populates="song", cascade="all, delete-orphan"
    )


class Lyric(Base):
    __tablename__ = "lyrics"
    id: Mapped[int] = mapped_column(primary_key=True)
    song_id: Mapped[int] = mapped_column(ForeignKey("songs.id", ondelete="CASCADE"), index=True)
    raw_text: Mapped[str] = mapped_column(Text)
    clean_text: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(20), default="es")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    song: Mapped["Song"] = relationship(back_populates="lyrics")


class VocabularyEntry(Base):
    __tablename__ = "vocabulary_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    song_id: Mapped[int] = mapped_column(ForeignKey("songs.id", ondelete="CASCADE"), index=True)
    lyric_id: Mapped[int] = mapped_column(ForeignKey("lyrics.id", ondelete="CASCADE"), index=True)
    original_word: Mapped[str] = mapped_column(String(120))
    lemma: Mapped[str] = mapped_column(String(120))
    infinitive_form: Mapped[str | None] = mapped_column(String(120), nullable=True)
    english_translation: Mapped[str] = mapped_column(String(255))
    context_line: Mapped[str] = mapped_column(Text)
    part_of_speech: Mapped[str] = mapped_column(String(20))
    is_selected: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    song: Mapped["Song"] = relationship(back_populates="vocabulary_entries")

    __table_args__ = (Index("ix_vocabulary_song_pos", "song_id", "part_of_speech"),)


class Playlist(Base):
    __tablename__ = "playlists"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    songs: Mapped[list["PlaylistSong"]] = relationship(back_populates="playlist", cascade="all, delete-orphan")


class PlaylistSong(Base):
    __tablename__ = "playlist_songs"
    id: Mapped[int] = mapped_column(primary_key=True)
    playlist_id: Mapped[int] = mapped_column(ForeignKey("playlists.id", ondelete="CASCADE"), index=True)
    song_id: Mapped[int] = mapped_column(ForeignKey("songs.id", ondelete="CASCADE"), index=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    playlist: Mapped["Playlist"] = relationship(back_populates="songs")

    __table_args__ = (UniqueConstraint("playlist_id", "song_id", name="uq_playlist_song"),)
