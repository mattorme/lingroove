from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Lyric, VocabularyEntry
from app.schemas.schemas import AnalyzeLyricsRequest, AnalyzeLyricsResponse
from app.services.analysis_payload import build_analyze_response, entries_from_vocab_rows
from app.services.nlp_pipeline import extract_vocabulary

router = APIRouter()


@router.post("/analyze-lyrics", response_model=AnalyzeLyricsResponse)
def analyze_lyrics(payload: AnalyzeLyricsRequest, db: Session = Depends(get_db)):
    lyric = db.query(Lyric).filter(Lyric.song_id == payload.songId).order_by(Lyric.id.desc()).first()
    if lyric is None:
        raise HTTPException(status_code=404, detail="Lyrics not found for song")

    db.execute(delete(VocabularyEntry).where(VocabularyEntry.song_id == payload.songId))
    extracted = extract_vocabulary(lyric.clean_text)
    saved: list[VocabularyEntry] = []
    for item in extracted:
        row = VocabularyEntry(song_id=payload.songId, lyric_id=lyric.id, **item, is_selected=True)
        db.add(row)
        db.flush()
        saved.append(row)
    db.commit()

    entries = entries_from_vocab_rows(saved)
    return build_analyze_response(payload.songId, lyric.clean_text, entries)
