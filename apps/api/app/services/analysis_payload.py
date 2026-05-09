from collections import defaultdict

from app.models.models import VocabularyEntry
from app.schemas.schemas import AnalyzeLyricsResponse, VocabularyOut


def entries_from_vocab_rows(rows: list[VocabularyEntry]) -> list[VocabularyOut]:
    return [
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


def build_analyze_response(song_id: int, cleaned_lyrics: str, entries: list[VocabularyOut]) -> AnalyzeLyricsResponse:
    grouped: dict[str, list[VocabularyOut]] = defaultdict(list)
    for e in entries:
        grouped[e.partOfSpeech].append(e)
    return AnalyzeLyricsResponse(
        songId=song_id,
        cleanedLyrics=cleaned_lyrics,
        grouped=dict(grouped),
        entries=entries,
    )
