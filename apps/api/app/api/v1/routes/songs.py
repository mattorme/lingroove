from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Lyric, Song, User, VocabularyEntry
from app.schemas.schemas import AnalyzeLyricsResponse, SongListResponse, SongSummary, VocabularyOut

router = APIRouter()


@router.get("/songs", response_model=SongListResponse)
def list_songs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(Song).filter(Song.user_id == current_user.id).order_by(Song.created_at.desc()).all()
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
def get_saved_analysis(
    song_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    song = db.query(Song).filter(Song.id == song_id).first()
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")
    if song.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised")
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
