"""Spanish lemma/surface → English gloss. Uses a small offline lexicon plus optional Google (deep-translator)."""

from __future__ import annotations

from app.core.config import settings

# Offline lexicon for tests, rate limits, and stub/offline translation modes
_STATIC_LEXICON: dict[str, str] = {
    "amar": "to love",
    "ser": "to be",
    "estar": "to be",
    "tener": "to have",
    "hacer": "to do / to make",
    "poder": "can / to be able",
    "decir": "to say",
    "ir": "to go",
    "ver": "to see",
    "dar": "to give",
    "saber": "to know",
    "querer": "to want",
    "llegar": "to arrive",
    "pasar": "to pass / to happen",
    "deber": "must / to owe",
    "poner": "to put",
    "parecer": "to seem",
    "quedar": "to stay / to remain",
    "creer": "to believe",
    "hablar": "to speak",
    "llevar": "to carry / to wear",
    "dejar": "to leave / to let",
    "seguir": "to follow / to continue",
    "encontrar": "to find",
    "llamar": "to call",
    "venir": "to come",
    "pensar": "to think",
    "salir": "to leave / to go out",
    "volver": "to return",
    "tomar": "to take / to drink",
    "conocer": "to know (a person/place)",
    "vivir": "to live",
    "sentir": "to feel",
    "tratar": "to try / to treat",
    "mirar": "to look (at)",
    "contar": "to count / to tell",
    "empezar": "to begin",
    "esperar": "to wait / to hope",
    "buscar": "to search",
    "existir": "to exist",
    "entrar": "to enter",
    "trabajar": "to work",
    "escribir": "to write",
    "perder": "to lose",
    "producir": "to produce",
    "ocurrir": "to occur",
    "entender": "to understand",
    "pedir": "to ask for",
    "recibir": "to receive",
    "recordar": "to remember",
    "terminar": "to finish",
    "permitir": "to allow",
    "aparecer": "to appear",
    "conseguir": "to get / to achieve",
    "comenzar": "to begin",
    "servir": "to serve",
    "sacar": "to take out",
    "necesitar": "to need",
    "mantener": "to maintain",
    "resultar": "to turn out",
    "leer": "to read",
    "caer": "to fall",
    "cambiar": "to change",
    "presentar": "to present",
    "crear": "to create",
    "abrir": "to open",
    "considerar": "to consider",
    "oír": "to hear",
    "acabar": "to finish",
    "ganar": "to win / to earn",
    "formar": "to form",
    "traer": "to bring",
    "partir": "to leave / to split",
    "morir": "to die",
    "aceptar": "to accept",
    "realizar": "to carry out",
    "suponer": "to suppose",
    "comprender": "to understand",
    "lograr": "to manage / to achieve",
    "explicar": "to explain",
    "preguntar": "to ask",
    "tocar": "to touch / to play (music)",
    "reconocer": "to recognize",
    "estudiar": "to study",
    "alcanzar": "to reach",
    "nacer": "to be born",
    "dirigir": "to direct",
    "correr": "to run",
    "utilizar": "to use",
    "pagar": "to pay",
    "ayudar": "to help",
    "gustar": "to please / to like",
    "jugar": "to play",
    "escuchar": "to listen",
    "cumplir": "to fulfill",
    "ofrecer": "to offer",
    "descubrir": "to discover",
    "levantar": "to lift / to get up",
    "intentar": "to try",
    "usar": "to use",
    "decidir": "to decide",
    "romper": "to break",
    "olvidar": "to forget",
    "bailar": "to dance",
    "cantar": "to sing",
    "canción": "song",
    "cancion": "song",
    "noche": "night",
    "día": "day",
    "dia": "day",
    "amor": "love",
    "corazón": "heart",
    "corazon": "heart",
    "vida": "life",
    "mundo": "world",
    "casa": "house",
    "tiempo": "time",
    "mano": "hand",
    "lugar": "place",
}

_translation_cache: dict[str, str] = {}


def translate_spanish_lemma(lemma: str) -> str:
    """Translate a Spanish lemma (lowercased) to a short English gloss."""
    w = lemma.lower().strip()
    if not w:
        return ""
    if w in _STATIC_LEXICON:
        return _STATIC_LEXICON[w]
    if w in _translation_cache:
        return _translation_cache[w]

    provider = (settings.translation_provider or "google").lower()
    if provider in ("stub", "offline", "static"):
        return _STATIC_LEXICON.get(w, "English gloss unavailable")

    try:
        from deep_translator import GoogleTranslator

        en = GoogleTranslator(source="es", target="en").translate(w)
        if en:
            _translation_cache[w] = en
            return en
    except Exception:
        pass

    return _STATIC_LEXICON.get(w, "English gloss unavailable")


# Backwards-compatible name for nlp_pipeline
def translate_word(word: str) -> str:
    return translate_spanish_lemma(word)
