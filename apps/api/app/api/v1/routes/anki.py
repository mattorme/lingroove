from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Song, User, VocabularyEntry
from app.schemas.schemas import GenerateAnkiRequest
from app.services.anki_exporter import generate_anki_csv

router = APIRouter()


@router.post("/generate-anki")
def generate_anki(
    payload: GenerateAnkiRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    song = db.query(Song).filter(Song.id == payload.songId).first()
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")
    if song.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised")

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
