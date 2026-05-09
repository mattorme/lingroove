import re


def clean_lyrics(raw_text: str) -> str:
    text = re.sub(r"\[.*?\]", "", raw_text)
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    return "\n".join(lines)
