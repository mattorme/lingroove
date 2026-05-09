_STATIC_TRANSLATIONS = {
    "amar": "to love",
    "ser": "to be",
    "tener": "to have",
    "cancion": "song",
    "noche": "night",
}


def translate_word(word: str) -> str:
    return _STATIC_TRANSLATIONS.get(word.lower(), f"{word.lower()} (translation)")
