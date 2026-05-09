import spacy

from app.core.config import settings
from app.services.translation_service import translate_word

_nlp = None
POS_MAP = {"VERB": "verb", "NOUN": "noun", "ADJ": "adjective"}


def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load(settings.spacy_model)
        except OSError:
            _nlp = spacy.blank("es")
    return _nlp


def extract_vocabulary(text: str) -> list[dict]:
    nlp = _get_nlp()
    doc = nlp(text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    entries = []
    seen = set()

    for token in doc:
        if token.is_stop or token.is_punct or not token.text.strip():
            continue
        if token.pos_ not in POS_MAP:
            continue
        key = (token.text.lower(), token.pos_)
        if key in seen:
            continue
        seen.add(key)
        lemma = token.lemma_.lower() if token.lemma_ else token.text.lower()
        context = next((line for line in lines if token.text.lower() in line.lower()), text[:200])
        entries.append(
            {
                "original_word": token.text,
                "lemma": lemma,
                "infinitive_form": lemma if token.pos_ == "VERB" else None,
                "english_translation": translate_word(lemma),
                "context_line": context,
                "part_of_speech": POS_MAP[token.pos_],
            }
        )
    return entries
