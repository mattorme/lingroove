import requests
from bs4 import BeautifulSoup


def import_lyrics(source_type: str, source_value: str) -> str:
    if source_type == "raw":
        return source_value

    response = requests.get(source_value, timeout=10)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    text = soup.get_text(separator="\n")
    return text
