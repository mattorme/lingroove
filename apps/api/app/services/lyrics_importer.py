import ipaddress
import logging
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_USER_SAFE_FETCH_FAILED = "Could not fetch lyrics from that URL."
_USER_SAFE_INVALID_URL = "Only http(s) URLs are allowed for lyrics import."


def _hostname_is_blocked(host: str) -> bool:
    if not host:
        return True
    host = host.lower().removeprefix("[").removesuffix("]")
    if host in ("localhost", "metadata.google.internal", "metadata"):
        return True
    try:
        ip = ipaddress.ip_address(host)
        return bool(
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip == ipaddress.ip_address("0.0.0.0")
        )
    except ValueError:
        return False


def import_lyrics(source_type: str, source_value: str) -> str:
    if source_type == "raw":
        return source_value

    if not (source_value or "").strip():
        raise ValueError("URL is required.")

    parsed = urlparse(source_value.strip())
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError(_USER_SAFE_INVALID_URL)
    if _hostname_is_blocked(parsed.hostname):
        raise ValueError(_USER_SAFE_INVALID_URL)

    try:
        response = requests.get(
            source_value.strip(),
            timeout=10,
            headers={"User-Agent": "LingrooveLyricsImporter/1.0"},
            allow_redirects=True,
        )
        response.raise_for_status()
    except requests.RequestException:
        logger.warning("Lyrics URL fetch failed", exc_info=True)
        raise ValueError(_USER_SAFE_FETCH_FAILED) from None

    soup = BeautifulSoup(response.text, "html.parser")
    text = soup.get_text(separator="\n")
    return text
