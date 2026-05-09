from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Lyric, Song, User
from app.schemas.schemas import ImportLyricsRequest, ImportLyricsResponse
from app.services.lyrics_cleaner import clean_lyrics
from app.services.lyrics_importer import import_lyrics

router = APIRouter()


@router.post("/import-lyrics", response_model=ImportLyricsResponse)
def import_lyrics_endpoint(payload: ImportLyricsRequest, db: Session = Depends(get_db)):
    raw_text = import_lyrics(payload.sourceType, payload.sourceValue)
    cleaned = clean_lyrics(raw_text)
    user = db.query(User).filter(User.id == payload.userId).first()
    if user is None:
        # MVP-friendly bootstrap: auto-create users referenced by import requests.
        user = User(
            id=payload.userId,
            email=f"user{payload.userId}@lingroove.local",
            display_name=f"User {payload.userId}",
        )
        db.add(user)
        db.flush()
    song = Song(
        user_id=payload.userId,
        title=payload.title,
        artist=payload.artist,
        source_type=payload.sourceType,
        source_url=payload.sourceValue if payload.sourceType == "url" else None,
    )
    db.add(song)
    db.flush()
    lyric = Lyric(song_id=song.id, raw_text=raw_text, clean_text=cleaned, language="es")
    db.add(lyric)
    db.commit()
    db.refresh(lyric)
    return ImportLyricsResponse(songId=song.id, lyricId=lyric.id, cleanedLyrics=cleaned, detectedLanguage="es")
