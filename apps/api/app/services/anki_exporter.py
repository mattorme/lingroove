import csv
import io


def generate_anki_csv(rows: list[dict]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Spanish Word",
            "English Translation",
            "Context Sentence",
            "Part of Speech",
            "Infinitive Form (if applicable)",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row["original_word"],
                row["english_translation"],
                row["context_line"],
                row["part_of_speech"],
                row["infinitive_form"] or "",
            ]
        )
    return output.getvalue()
