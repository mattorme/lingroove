from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Lyric, Song, VocabularyEntry
from app.schemas.schemas import AnalyzeLyricsResponse, SongListResponse, SongSummary, VocabularyOut

router = APIRouter()


@router.get("/songs", response_model=SongListResponse)
def list_songs(userId: int = Query(..., ge=1), db: Session = Depends(get_db)):
    rows = db.query(Song).filter(Song.user_id == userId).order_by(Song.created_at.desc()).all()
    return SongListResponse(
        songs=[
            SongSummary(
                id=s.id,
                title=s.title,
                artist=s.artist,
                sourceType=s.source_type,
                createdAt=s.created_at.isoformat() if s.created_at else "",
            )
            for s in rows
        ]
    )


@router.get("/songs/{song_id}/analysis", response_model=AnalyzeLyricsResponse)
def get_saved_analysis(song_id: int, db: Session = Depends(get_db)):
    lyric = db.query(Lyric).filter(Lyric.song_id == song_id).order_by(Lyric.id.desc()).first()
    if lyric is None:
        raise HTTPException(status_code=404, detail="Lyrics not found for song")
    rows = (
        db.query(VocabularyEntry)
        .filter(VocabularyEntry.song_id == song_id)
        .order_by(VocabularyEntry.id.asc())
        .all()
    )
    entries = [
        VocabularyOut(
            id=r.id,
            originalWord=r.original_word,
            infinitiveForm=r.infinitive_form,
            englishTranslation=r.english_translation,
            contextSentence=r.context_line,
            partOfSpeech=r.part_of_speech,
            isSelected=r.is_selected,
        )
        for r in rows
    ]
    grouped: dict[str, list[VocabularyOut]] = defaultdict(list)
    for e in entries:
        grouped[e.partOfSpeech].append(e)
    return AnalyzeLyricsResponse(
        songId=song_id,
        cleanedLyrics=lyric.clean_text,
        grouped=dict(grouped),
        entries=entries,
    )
