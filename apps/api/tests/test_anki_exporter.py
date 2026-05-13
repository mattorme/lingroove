import csv
import io

from app.services.anki_exporter import ANKI_CSV_COLUMNS, generate_anki_csv, iter_anki_csv_bytes, safe_playlist_export_filename


def test_generate_anki_csv_empty_rows_headers_only():
    csv_text = generate_anki_csv([])
    row = next(csv.reader(io.StringIO(csv_text.strip())))
    assert row == ANKI_CSV_COLUMNS


def test_iter_anki_csv_bytes_empty_iterator():
    chunks = list(iter_anki_csv_bytes(iter(())))
    assert len(chunks) >= 1
    joined = b"".join(chunks).decode("utf-8")
    row = next(csv.reader(io.StringIO(joined.strip())))
    assert row == ANKI_CSV_COLUMNS


def test_safe_playlist_export_filename():
    assert safe_playlist_export_filename("My Cool Mix") == "My-Cool-Mix.csv"
    assert safe_playlist_export_filename("  ") == "playlist.csv"
