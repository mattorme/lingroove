from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


def import_lyrics(source_type: str, source_value: str) -> str:
    if source_type == "raw":
        return source_value

    url = source_value.strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError(
            "URL import needs a full address starting with http:// or https://. "
            "If you pasted lyrics, choose Raw Lyrics instead."
        )

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise ValueError(f"Could not download that page: {e}") from e

    soup = BeautifulSoup(response.text, "html.parser")
    text = soup.get_text(separator="\n")
    return text
