from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Playlist, PlaylistSong, Song, VocabularyEntry
from app.schemas.schemas import (
    AddSongToPlaylistRequest,
    CreatePlaylistRequest,
    PlaylistCreateResponse,
    PlaylistListResponse,
    PlaylistResponse,
    PlaylistSongOut,
    PlaylistSummary,
)
from app.services.local_user import ensure_local_mvp_user

router = APIRouter()


@router.get("/playlists", response_model=PlaylistListResponse)
def list_playlists(userId: int = Query(..., ge=1), db: Session = Depends(get_db)):
    playlists = db.query(Playlist).filter(Playlist.user_id == userId).order_by(Playlist.created_at.desc()).all()
    if not playlists:
        return PlaylistListResponse(playlists=[])
    ids = [p.id for p in playlists]
    count_rows = (
        db.query(PlaylistSong.playlist_id, func.count(PlaylistSong.id))
        .filter(PlaylistSong.playlist_id.in_(ids))
        .group_by(PlaylistSong.playlist_id)
        .all()
    )
    count_map = {pid: int(cnt) for pid, cnt in count_rows}
    return PlaylistListResponse(
        playlists=[
            PlaylistSummary(
                id=p.id,
                name=p.name,
                description=p.description,
                songCount=count_map.get(p.id, 0),
            )
            for p in playlists
        ]
    )


@router.post("/playlist/create", response_model=PlaylistCreateResponse)
def create_playlist(payload: CreatePlaylistRequest, db: Session = Depends(get_db)):
    ensure_local_mvp_user(db, payload.userId)
    playlist = Playlist(user_id=payload.userId, name=payload.name, description=payload.description)
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return PlaylistCreateResponse(id=playlist.id, userId=playlist.user_id, name=playlist.name, description=playlist.description)


@router.post("/playlist/{playlist_id}/songs")
def add_song_to_playlist(
    playlist_id: int, payload: AddSongToPlaylistRequest, db: Session = Depends(get_db)
):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if playlist is None:
        raise HTTPException(status_code=404, detail="Playlist not found")
    song = db.query(Song).filter(Song.id == payload.songId).first()
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")
    if song.user_id != playlist.user_id:
        raise HTTPException(status_code=400, detail="Song and playlist must belong to the same user")
    existing = (
        db.query(PlaylistSong)
        .filter(PlaylistSong.playlist_id == playlist_id, PlaylistSong.song_id == payload.songId)
        .first()
    )
    if existing is None:
        db.add(PlaylistSong(playlist_id=playlist_id, song_id=payload.songId))
        db.commit()
    return {"ok": True, "playlistId": playlist_id, "songId": payload.songId}


@router.get("/playlist/{playlist_id}", response_model=PlaylistResponse)
def get_playlist(playlist_id: int, db: Session = Depends(get_db)):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if playlist is None:
        raise HTTPException(status_code=404, detail="Playlist not found")

    joins = (
        db.query(Song)
        .join(PlaylistSong, PlaylistSong.song_id == Song.id)
        .filter(PlaylistSong.playlist_id == playlist_id)
        .all()
    )
    vocab_count = (
        db.query(func.count(VocabularyEntry.id))
        .join(Song, Song.id == VocabularyEntry.song_id)
        .join(PlaylistSong, PlaylistSong.song_id == Song.id)
        .filter(PlaylistSong.playlist_id == playlist_id)
        .scalar()
    )
    songs = [PlaylistSongOut(songId=s.id, title=s.title, artist=s.artist) for s in joins]
    return PlaylistResponse(
        id=playlist.id,
        name=playlist.name,
        description=playlist.description,
        songs=songs,
        vocabularyCount=vocab_count or 0,
    )
