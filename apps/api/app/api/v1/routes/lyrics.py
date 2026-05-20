from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Lyric, Song, User
from app.schemas.schemas import ImportLyricsRequest, ImportLyricsResponse
from app.services.lyrics_cleaner import clean_lyrics
from app.services.lyrics_importer import fetch_song_metadata, import_lyrics

router = APIRouter()


@router.get("/song-metadata")
def song_metadata_endpoint(
    url: str = Query(..., description="Lyrics page URL to extract metadata from"),
    _current_user: User = Depends(get_current_user),
):
    """Return best-effort title, artist, and artwork_url extracted from the given URL."""
    try:
        title, artist, artwork_url = fetch_song_metadata(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"title": title, "artist": artist, "artworkUrl": artwork_url}


@router.post("/import-lyrics", response_model=ImportLyricsResponse)
def import_lyrics_endpoint(
    payload: ImportLyricsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        raw_text, artwork_url = import_lyrics(payload.sourceType, payload.sourceValue)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    cleaned = clean_lyrics(raw_text)
    song = Song(
        user_id=current_user.id,
        title=payload.title,
        artist=payload.artist,
        source_type=payload.sourceType,
        source_url=payload.sourceValue if payload.sourceType == "url" else None,
        artwork_url=artwork_url,
    )
    db.add(song)
    db.flush()
    lyric = Lyric(song_id=song.id, raw_text=raw_text, clean_text=cleaned, language="es")
    db.add(lyric)
    db.commit()
    db.refresh(lyric)
    return ImportLyricsResponse(songId=song.id, lyricId=lyric.id, cleanedLyrics=cleaned, detectedLanguage="es")
