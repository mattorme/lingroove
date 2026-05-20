import csv
import hashlib
import io
import os
import re
import tempfile
from collections.abc import Iterator

import genanki

ANKI_CSV_COLUMNS = [
    "Spanish Word",
    "English Translation",
    "Infinitive Translation",
    "Context Sentence",
    "Part of Speech",
    "Infinitive Form (if applicable)",
]


def vocabulary_entry_to_row_dict(entry) -> dict:
    """Map a VocabularyEntry ORM instance to the row dict used by Anki CSV export."""
    return {
        "original_word": entry.original_word,
        "english_translation": entry.english_translation,
        "conjugated_translation": getattr(entry, "conjugated_translation", None),
        "context_line": entry.context_line,
        "part_of_speech": entry.part_of_speech,
        "infinitive_form": entry.infinitive_form,
    }


def row_dict_to_anki_cells(row: dict) -> list[str]:
    conjugated = row.get("conjugated_translation") or ""
    infinitive = row["english_translation"]
    return [
        row["original_word"],
        conjugated or infinitive,
        infinitive if conjugated else "",
        row["context_line"],
        row["part_of_speech"],
        row["infinitive_form"] or "",
    ]


def generate_anki_csv(rows: list[dict]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(ANKI_CSV_COLUMNS)
    for row in rows:
        writer.writerow(row_dict_to_anki_cells(row))
    return output.getvalue()


def safe_playlist_export_filename(playlist_name: str) -> str:
    """ASCII-safe filename: playlist-name.csv"""
    base = playlist_name.strip() or "playlist"
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", base).strip("-_.") or "playlist"
    if not slug.lower().endswith(".csv"):
        slug = f"{slug}.csv"
    return slug


# Stable IDs so re-imports update existing notes rather than duplicating them.
_MODEL_ID = 1_607_392_319
_DECK_ID_BASE = 1_607_392_320

_ANKI_MODEL = genanki.Model(
    _MODEL_ID,
    "Lingroove Spanish",
    fields=[
        {"name": "Spanish Word"},
        {"name": "English Translation"},
        {"name": "Infinitive Translation"},
        {"name": "Context Sentence"},
        {"name": "Part of Speech"},
        {"name": "Infinitive Form"},
    ],
    templates=[
        {
            "name": "Recall",
            "qfmt": "<b>{{Spanish Word}}</b><br><small>{{Part of Speech}}</small>",
            "afmt": "{{FrontSide}}<hr id=answer>"
                    "{{English Translation}}"
                    "{{#Infinitive Translation}}<br><small>(infinitive: {{Infinitive Translation}})</small>{{/Infinitive Translation}}"
                    "<br><br><i>{{Context Sentence}}</i>"
                    "{{#Infinitive Form}}<br><small>∞ {{Infinitive Form}}</small>{{/Infinitive Form}}",
        },
    ],
)


def generate_anki_package(rows: list[dict], deck_name: str = "Lingroove") -> bytes:
    """Generate a native Anki .apkg package from vocabulary rows."""
    # Use a stable MD5-based ID so re-importing the same deck updates notes rather than duplicating.
    stable_hash = int(hashlib.md5(deck_name.encode()).hexdigest(), 16) & 0xFFFF_FFFF
    deck_id = _DECK_ID_BASE + stable_hash
    deck = genanki.Deck(deck_id, deck_name)
    for row in rows:
        cells = row_dict_to_anki_cells(row)
        note = genanki.Note(model=_ANKI_MODEL, fields=cells)
        deck.add_note(note)
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".apkg")
    os.close(tmp_fd)
    try:
        genanki.Package(deck).write_to_file(tmp_path)
        with open(tmp_path, "rb") as f:
            return f.read()
    finally:
        os.unlink(tmp_path)


def iter_anki_csv_bytes(rows: Iterator[dict], chunk_bytes: int = 65536) -> Iterator[bytes]:
    """Stream UTF-8 CSV chunks for large exports; always includes header row first."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(ANKI_CSV_COLUMNS)
    for row in rows:
        writer.writerow(row_dict_to_anki_cells(row))
        if buffer.tell() >= chunk_bytes:
            yield buffer.getvalue().encode("utf-8")
            buffer.seek(0)
            buffer.truncate(0)
    if buffer.tell():
        yield buffer.getvalue().encode("utf-8")
