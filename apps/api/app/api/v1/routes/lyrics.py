from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Lyric, Song
from app.schemas.schemas import ImportLyricsRequest, ImportLyricsResponse
from app.services.local_user import ensure_local_mvp_user
from app.services.lyrics_cleaner import clean_lyrics
from app.services.lyrics_importer import import_lyrics

router = APIRouter()


@router.post("/import-lyrics", response_model=ImportLyricsResponse)
def import_lyrics_endpoint(payload: ImportLyricsRequest, db: Session = Depends(get_db)):
    try:
        raw_text = import_lyrics(payload.sourceType, payload.sourceValue)
    except ValueError as e:
        # import_lyrics raises ValueError only with fixed, client-safe messages
        raise HTTPException(status_code=400, detail=str(e)) from e
    cleaned = clean_lyrics(raw_text)
    ensure_local_mvp_user(db, payload.userId)
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
