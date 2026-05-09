from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import VocabularyEntry
from app.schemas.schemas import GenerateAnkiRequest
from app.services.anki_exporter import generate_anki_csv

router = APIRouter()


@router.post("/generate-anki")
def generate_anki(payload: GenerateAnkiRequest, db: Session = Depends(get_db)):
    rows = (
        db.query(VocabularyEntry)
        .filter(
            VocabularyEntry.song_id == payload.songId,
            VocabularyEntry.id.in_(payload.selectedVocabularyIds),
        )
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="No vocabulary entries selected")

    csv_text = generate_anki_csv(
        [
            {
                "original_word": r.original_word,
                "english_translation": r.english_translation,
                "context_line": r.context_line,
                "part_of_speech": r.part_of_speech,
                "infinitive_form": r.infinitive_form,
            }
            for r in rows
        ]
    )
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="lingroove-anki.csv"'},
    )
