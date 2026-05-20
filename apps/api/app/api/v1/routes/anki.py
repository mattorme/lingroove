from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Song, User, VocabularyEntry
from app.schemas.schemas import GenerateAnkiRequest
from app.services.anki_exporter import generate_anki_csv, generate_anki_package, vocabulary_entry_to_row_dict

router = APIRouter()


def _get_vocab_rows(db: Session, payload: GenerateAnkiRequest, current_user: User) -> tuple[Song, list[dict]]:
    song = db.query(Song).filter(Song.id == payload.songId).first()
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")
    if song.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised")
    entries = (
        db.query(VocabularyEntry)
        .filter(
            VocabularyEntry.song_id == payload.songId,
            VocabularyEntry.id.in_(payload.selectedVocabularyIds),
        )
        .all()
    )
    if not entries:
        raise HTTPException(status_code=404, detail="No vocabulary entries selected")
    return song, [vocabulary_entry_to_row_dict(e) for e in entries]


@router.post("/generate-anki")
def generate_anki_csv_endpoint(
    payload: GenerateAnkiRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, rows = _get_vocab_rows(db, payload, current_user)
    csv_text = generate_anki_csv(rows)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="lingroove-anki.csv"'},
    )


@router.post("/generate-anki-pkg")
def generate_anki_pkg_endpoint(
    payload: GenerateAnkiRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    song, rows = _get_vocab_rows(db, payload, current_user)
    deck_name = f"Lingroove – {song.title}"
    pkg_bytes = generate_anki_package(rows, deck_name=deck_name)
    safe_title = "".join(c if c.isalnum() or c in "-_ " else "" for c in song.title).strip() or "song"
    filename = f"lingroove-{safe_title}.apkg"
    return Response(
        content=pkg_bytes,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
