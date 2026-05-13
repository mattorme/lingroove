from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.models.models import Playlist, PlaylistSong, Song, VocabularyEntry
from app.schemas.schemas import (
    AddSongToPlaylistRequest,
    CreatePlaylistRequest,
    PlaylistCreateResponse,
    PlaylistListResponse,
    PlaylistResponse,
    PlaylistSongOut,
    PlaylistSummary,
    RenamePlaylistRequest,
)
from app.services.anki_exporter import iter_anki_csv_bytes, safe_playlist_export_filename, vocabulary_entry_to_row_dict
from app.services.local_user import ensure_local_mvp_user

router = APIRouter()


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _get_playlist_or_404(db: Session, playlist_id: int) -> Playlist:
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if playlist is None:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist


def _playlist_to_response(playlist: Playlist) -> PlaylistCreateResponse:
    return PlaylistCreateResponse(
        id=playlist.id,
        userId=playlist.user_id,
        name=playlist.name,
        description=playlist.description,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/playlists", response_model=PlaylistListResponse)
def list_playlists(userId: int = Query(..., ge=1), db: Session = Depends(get_db)):
    # Single query: join song counts to avoid N+1
    rows = (
        db.query(Playlist, func.count(PlaylistSong.id).label("song_count"))
        .outerjoin(PlaylistSong, PlaylistSong.playlist_id == Playlist.id)
        .filter(Playlist.user_id == userId)
        .group_by(Playlist.id)
        .order_by(Playlist.created_at.desc())
        .all()
    )
    return PlaylistListResponse(
        playlists=[
            PlaylistSummary(id=p.id, name=p.name, description=p.description, songCount=count)
            for p, count in rows
        ]
    )


@router.post("/playlist/create", response_model=PlaylistCreateResponse)
def create_playlist(payload: CreatePlaylistRequest, db: Session = Depends(get_db)):
    ensure_local_mvp_user(db, payload.userId)
    playlist = Playlist(user_id=payload.userId, name=payload.name.strip(), description=payload.description)
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return _playlist_to_response(playlist)


@router.patch("/playlist/{playlist_id}", response_model=PlaylistCreateResponse)
def rename_playlist(playlist_id: int, payload: RenamePlaylistRequest, db: Session = Depends(get_db)):
    playlist = _get_playlist_or_404(db, playlist_id)
    playlist.name = payload.name.strip()
    db.commit()
    db.refresh(playlist)
    return _playlist_to_response(playlist)


@router.delete("/playlist/{playlist_id}")
def delete_playlist(playlist_id: int, db: Session = Depends(get_db)):
    playlist = _get_playlist_or_404(db, playlist_id)
    db.delete(playlist)
    db.commit()
    return {"ok": True}


@router.post("/playlist/{playlist_id}/songs")
def add_song_to_playlist(
    playlist_id: int, payload: AddSongToPlaylistRequest, db: Session = Depends(get_db)
):
    playlist = _get_playlist_or_404(db, playlist_id)
    song = db.query(Song).filter(Song.id == payload.songId).first()
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")
    if song.user_id != playlist.user_id:
        raise HTTPException(status_code=403, detail="Song does not belong to the same user as the playlist")
    existing = (
        db.query(PlaylistSong)
        .filter(PlaylistSong.playlist_id == playlist_id, PlaylistSong.song_id == payload.songId)
        .first()
    )
    if existing is not None:
        return {"ok": True, "playlistId": playlist_id, "songId": payload.songId, "duplicate": True}
    db.add(PlaylistSong(playlist_id=playlist_id, song_id=payload.songId))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"ok": True, "playlistId": playlist_id, "songId": payload.songId, "duplicate": True}
    return {"ok": True, "playlistId": playlist_id, "songId": payload.songId, "duplicate": False}


@router.delete("/playlist/{playlist_id}/songs/{song_id}")
def remove_song_from_playlist(playlist_id: int, song_id: int, db: Session = Depends(get_db)):
    _get_playlist_or_404(db, playlist_id)
    link = (
        db.query(PlaylistSong)
        .filter(PlaylistSong.playlist_id == playlist_id, PlaylistSong.song_id == song_id)
        .first()
    )
    if link is None:
        raise HTTPException(status_code=404, detail="Song not in playlist")
    db.delete(link)
    db.commit()
    return {"ok": True}


def _playlist_vocab_rows(db: Session, playlist_id: int):
    q = (
        db.query(VocabularyEntry)
        .join(Song, Song.id == VocabularyEntry.song_id)
        .join(PlaylistSong, PlaylistSong.song_id == Song.id)
        .filter(PlaylistSong.playlist_id == playlist_id)
        .order_by(VocabularyEntry.id.asc())
        .yield_per(1000)
    )
    for entry in q:
        yield vocabulary_entry_to_row_dict(entry)


@router.get("/playlist/{playlist_id}/export-csv")
def export_playlist_csv(playlist_id: int, db: Session = Depends(get_db)):
    playlist = _get_playlist_or_404(db, playlist_id)
    filename = safe_playlist_export_filename(playlist.name)

    def row_stream():
        # Use a dedicated session so the request session can close independently.
        inner: Session = SessionLocal()
        try:
            yield from _playlist_vocab_rows(inner, playlist_id)
        finally:
            inner.close()

    return StreamingResponse(
        iter_anki_csv_bytes(row_stream()),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/playlist/{playlist_id}", response_model=PlaylistResponse)
def get_playlist(playlist_id: int, db: Session = Depends(get_db)):
    playlist = _get_playlist_or_404(db, playlist_id)
    rows = (
        db.query(Song, PlaylistSong.added_at)
        .join(PlaylistSong, PlaylistSong.song_id == Song.id)
        .filter(PlaylistSong.playlist_id == playlist_id)
        .order_by(PlaylistSong.added_at.asc(), Song.id.asc())
        .all()
    )
    vocab_count = (
        db.query(func.count(VocabularyEntry.id))
        .join(Song, Song.id == VocabularyEntry.song_id)
        .join(PlaylistSong, PlaylistSong.song_id == Song.id)
        .filter(PlaylistSong.playlist_id == playlist_id)
        .scalar()
    )
    return PlaylistResponse(
        id=playlist.id,
        name=playlist.name,
        description=playlist.description,
        songs=[PlaylistSongOut(songId=s.id, title=s.title, artist=s.artist) for s, _ in rows],
        vocabularyCount=vocab_count or 0,
    )
