from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Lyric, VocabularyEntry
from app.schemas.schemas import AnalyzeLyricsRequest, AnalyzeLyricsResponse, VocabularyOut
from app.services.nlp_pipeline import extract_vocabulary, group_by_pos

router = APIRouter()


@router.post("/analyze-lyrics", response_model=AnalyzeLyricsResponse)
def analyze_lyrics(payload: AnalyzeLyricsRequest, db: Session = Depends(get_db)):
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

    entries = [
        VocabularyOut(
            id=row.id,
            originalWord=row.original_word,
            infinitiveForm=row.infinitive_form,
            englishTranslation=row.english_translation,
            contextSentence=row.context_line,
            partOfSpeech=row.part_of_speech,
            isSelected=row.is_selected,
        )
        for row in saved
    ]
    grouped_raw = group_by_pos(extracted)
    grouped = {
        key: [
            VocabularyOut(
                id=row.id,
                originalWord=row.original_word,
                infinitiveForm=row.infinitive_form,
                englishTranslation=row.english_translation,
                contextSentence=row.context_line,
                partOfSpeech=row.part_of_speech,
                isSelected=row.is_selected,
            )
            for row in saved
            if row.part_of_speech == key
        ]
        for key in grouped_raw.keys()
    }
    return AnalyzeLyricsResponse(songId=payload.songId, grouped=grouped, entries=entries)
