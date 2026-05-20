import spacy

from app.core.config import settings
from app.services.translation_service import translate_batch

_nlp = None
POS_MAP = {"VERB": "verb", "NOUN": "noun", "ADJ": "adjective"}

# Clitic pronouns that attach to Spanish verbs (longest first to avoid partial matches)
_CLITIC_SUFFIXES = ("los", "las", "les", "nos", "me", "te", "se", "le", "lo", "la", "os")

# Spanish accent characters — their presence in a word ending in a clitic is a
# strong indicator that the word is a verb+clitic form (Spanish adds accents to
# preserve stress when clitics attach, e.g. ábranse, siéntense, duérmanse).
_ACCENT_CHARS = frozenset("áéíóúüÁÉÍÓÚÜ")


def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load(settings.spacy_model)
        except OSError:
            _nlp = spacy.blank("es")
    return _nlp


def _get_reflexive_infinitive(token, lemma: str) -> str | None:
    """Return the reflexive infinitive if this verb is used reflexively, else None.

    Checks for the 'expl:pv' dependency label which spaCy assigns to reflexive
    pronouns in Spanish (se levanta → levantarse, nos quedamos → quedarse).
    The lemma must already be a valid infinitive (ending in ar/er/ir) to avoid
    producing nonsense forms from bad spaCy lemmas (e.g. muero → muerose).
    """
    if not lemma.endswith(("ar", "er", "ir")):
        return None
    for child in token.children:
        if child.dep_ == "expl:pv":
            return lemma + "se"
    return None


def _extract_clitic_verb_stem(word: str) -> str | None:
    """Detect verb+clitic forms that spaCy mislabels as NOUN/ADJ/PROPN.

    es_core_news_md consistently fails on plural reflexive imperatives like
    ábranse (NOUN), siéntense (ADJ), quédense (ADJ). The accent-mark heuristic
    is reliable: Spanish adds accents specifically when clitics attach to verbs
    to preserve the original stress, so accented words ending in a clitic suffix
    are almost always verb+clitic forms. This avoids false positives on common
    nouns/adjectives like suerte, muerte, fuerte (no accent marks).

    Returns the verb stem without the clitic, preserving original casing/accents,
    or None if the word does not look like a verb+clitic form.
    """
    if not any(c in _ACCENT_CHARS for c in word):
        return None
    w = word.lower()
    for clitic in _CLITIC_SUFFIXES:
        if w.endswith(clitic) and len(w) > len(clitic) + 2:
            return word[: len(word) - len(clitic)]
    return None


def extract_vocabulary(text: str) -> list[dict]:
    nlp = _get_nlp()

    # Process each lyric line as its own sentence so spaCy's dependency parser
    # produces accurate per-line trees. Processing the full text as one doc
    # causes spaCy to merge lines into large run-on sentences, breaking reflexive
    # detection and other dep-based features. nlp.pipe() batches efficiently.
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    # First pass: collect unique tokens, their resolved POS labels, and lemmas.
    # token_data entries: (token, lemma, pos_label, context_line)
    seen: set[tuple[str, str]] = set()
    token_data: list[tuple[object, str, str, str]] = []

    for line, doc in zip(lines, nlp.pipe(lines)):
        for token in doc:
            if token.is_punct or not token.text.strip():
                continue

            pos_label = POS_MAP.get(token.pos_)
            lemma = token.lemma_.lower() if token.lemma_ else token.text.lower()

            # spaCy mislabels plural reflexive imperatives (ábranse, siéntense, …)
            # as NOUN, ADJ, or PROPN. Reclassify them using the accent heuristic.
            if pos_label != "verb" and token.pos_ in ("NOUN", "PROPN", "ADJ"):
                stem = _extract_clitic_verb_stem(token.text)
                if stem:
                    pos_label = "verb"
                    lemma = stem.lower()

            # For verbs used reflexively (se levanta, nos quedamos, …), upgrade
            # the lemma to the reflexive infinitive so the display and translation
            # reflect the reflexive form (levantarse, quedarse, …).
            if pos_label == "verb":
                refl = _get_reflexive_infinitive(token, lemma)
                if refl:
                    lemma = refl

            if pos_label is None:
                continue

            key = (token.text.lower(), pos_label)
            if key in seen:
                continue
            seen.add(key)
            token_data.append((token, lemma, pos_label, line))

    # Collect all words for translation: lemmas + conjugated verb surface forms
    all_lemmas = [lemma for _, lemma, _, _ in token_data]
    verb_surfaces = [
        token.text.lower()
        for token, lemma, pos_label, _ in token_data
        if pos_label == "verb" and token.text.lower() != lemma
    ]
    translations = translate_batch(list(set(all_lemmas + verb_surfaces)))

    # Second pass: build entries with pre-fetched translations
    entries = []
    for token, lemma, pos_label, context_line in token_data:
        surface = token.text.lower()
        is_verb = pos_label == "verb"
        conjugated_translation = None
        if is_verb and surface != lemma:
            conjugated_translation = translations.get(surface)
        entries.append(
            {
                "original_word": token.text,
                "lemma": lemma,
                "infinitive_form": lemma if is_verb else None,
                "english_translation": translations.get(lemma, "English gloss unavailable"),
                "conjugated_translation": conjugated_translation,
                "context_line": context_line,
                "part_of_speech": pos_label,
            }
        )
    return entries


