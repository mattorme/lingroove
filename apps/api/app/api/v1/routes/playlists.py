from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.security import get_current_user
from app.models.models import Playlist, PlaylistSong, Song, User, VocabularyEntry
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

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_playlist_or_404(db: Session, playlist_id: int) -> Playlist:
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if playlist is None:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist


def _assert_owner(playlist: Playlist, user: User) -> None:
    if playlist.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorised")


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
def list_playlists(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = (
        db.query(Playlist, func.count(PlaylistSong.id).label("song_count"))
        .outerjoin(PlaylistSong, PlaylistSong.playlist_id == Playlist.id)
        .filter(Playlist.user_id == current_user.id)
        .group_by(Playlist.id)
        .order_by(Playlist.created_at.desc())
        .all()
    )

    # Fetch up to 4 distinct artwork URLs per playlist in a single batched query.
    playlist_ids = [p.id for p, _ in rows]
    artwork_map: dict[int, list[str]] = defaultdict(list)
    if playlist_ids:
        artwork_rows = (
            db.query(PlaylistSong.playlist_id, Song.artwork_url)
            .join(Song, Song.id == PlaylistSong.song_id)
            .filter(PlaylistSong.playlist_id.in_(playlist_ids))
            .filter(Song.artwork_url.isnot(None))
            .order_by(PlaylistSong.added_at.asc(), Song.id.asc())
            .all()
        )
        for playlist_id, artwork_url in artwork_rows:
            existing = artwork_map[playlist_id]
            if len(existing) < 4 and artwork_url not in existing:
                existing.append(artwork_url)

    return PlaylistListResponse(
        playlists=[
            PlaylistSummary(
                id=p.id,
                name=p.name,
                description=p.description,
                songCount=count,
                artworkUrls=artwork_map[p.id],
            )
            for p, count in rows
        ]
    )


@router.post("/playlist/create", response_model=PlaylistCreateResponse)
def create_playlist(
    payload: CreatePlaylistRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    playlist = Playlist(user_id=current_user.id, name=payload.name.strip(), description=payload.description)
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return _playlist_to_response(playlist)


@router.patch("/playlist/{playlist_id}", response_model=PlaylistCreateResponse)
def rename_playlist(
    playlist_id: int,
    payload: RenamePlaylistRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    playlist = _get_playlist_or_404(db, playlist_id)
    _assert_owner(playlist, current_user)
    playlist.name = payload.name.strip()
    db.commit()
    db.refresh(playlist)
    return _playlist_to_response(playlist)


@router.delete("/playlist/{playlist_id}")
def delete_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    playlist = _get_playlist_or_404(db, playlist_id)
    _assert_owner(playlist, current_user)
    db.delete(playlist)
    db.commit()
    return {"ok": True}


@router.post("/playlist/{playlist_id}/songs")
def add_song_to_playlist(
    playlist_id: int,
    payload: AddSongToPlaylistRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    playlist = _get_playlist_or_404(db, playlist_id)
    _assert_owner(playlist, current_user)
    song = db.query(Song).filter(Song.id == payload.songId).first()
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")
    if song.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Song does not belong to you")
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
def remove_song_from_playlist(
    playlist_id: int,
    song_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    playlist = _get_playlist_or_404(db, playlist_id)
    _assert_owner(playlist, current_user)
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
def export_playlist_csv(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    playlist = _get_playlist_or_404(db, playlist_id)
    _assert_owner(playlist, current_user)
    filename = safe_playlist_export_filename(playlist.name)

    def row_stream():
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
def get_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    playlist = _get_playlist_or_404(db, playlist_id)
    _assert_owner(playlist, current_user)
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
        songs=[PlaylistSongOut(songId=s.id, title=s.title, artist=s.artist, artworkUrl=s.artwork_url) for s, _ in rows],
        vocabularyCount=vocab_count or 0,
    )
