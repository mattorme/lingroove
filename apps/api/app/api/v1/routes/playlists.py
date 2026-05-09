from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Playlist, PlaylistSong, Song, VocabularyEntry
from app.schemas.schemas import (
    CreatePlaylistRequest,
    PlaylistCreateResponse,
    PlaylistResponse,
    PlaylistSongOut,
)

router = APIRouter()


@router.post("/playlist/create", response_model=PlaylistCreateResponse)
def create_playlist(payload: CreatePlaylistRequest, db: Session = Depends(get_db)):
    playlist = Playlist(user_id=payload.userId, name=payload.name, description=payload.description)
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return PlaylistCreateResponse(id=playlist.id, userId=playlist.user_id, name=playlist.name, description=playlist.description)


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
