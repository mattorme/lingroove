import csv
import io
import re
from collections.abc import Iterator

ANKI_CSV_COLUMNS = [
    "Spanish Word",
    "English Translation",
    "Context Sentence",
    "Part of Speech",
    "Infinitive Form (if applicable)",
]


def vocabulary_entry_to_row_dict(entry) -> dict:
    """Map a VocabularyEntry ORM instance to the row dict used by Anki CSV export."""
    return {
        "original_word": entry.original_word,
        "english_translation": entry.english_translation,
        "context_line": entry.context_line,
        "part_of_speech": entry.part_of_speech,
        "infinitive_form": entry.infinitive_form,
    }


def row_dict_to_anki_cells(row: dict) -> list[str]:
    return [
        row["original_word"],
        row["english_translation"],
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
