from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Lyric, Song, User, VocabularyEntry
from app.schemas.schemas import AnalyzeLyricsRequest, AnalyzeLyricsResponse, VocabularyOut
from app.services.nlp_pipeline import extract_vocabulary

router = APIRouter()


@router.post("/analyze-lyrics", response_model=AnalyzeLyricsResponse)
def analyze_lyrics(
    payload: AnalyzeLyricsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    song = db.query(Song).filter(Song.id == payload.songId).first()
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")
    if song.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised")

    lyric = db.query(Lyric).filter(Lyric.song_id == payload.songId).order_by(Lyric.id.desc()).first()
    if lyric is None:
        raise HTTPException(status_code=404, detail="Lyrics not found for song")

    db.execute(delete(VocabularyEntry).where(VocabularyEntry.song_id == payload.songId))
    extracted = extract_vocabulary(lyric.clean_text)
    saved = []
    for item in extracted:
        row = VocabularyEntry(song_id=payload.songId, lyric_id=lyric.id, **item, is_selected=True)
        db.add(row)
        db.flush()
        saved.append(row)
    db.commit()

    entries = [VocabularyOut.from_orm_row(row) for row in saved]

    grouped: dict[str, list[VocabularyOut]] = defaultdict(list)
    for entry in entries:
        grouped[entry.partOfSpeech].append(entry)

    return AnalyzeLyricsResponse(
        songId=payload.songId,
        cleanedLyrics=lyric.clean_text,
        grouped=dict(grouped),
        entries=entries,
    )
