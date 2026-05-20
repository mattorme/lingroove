import ipaddress
import logging
import re
from dataclasses import dataclass
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_USER_SAFE_FETCH_FAILED = "Could not fetch lyrics from that URL."
_USER_SAFE_INVALID_URL = "Only http(s) URLs are allowed."
_USER_SAFE_GENIUS_ONLY = "Only Genius URLs are supported. Please paste a genius.com link."

_GENIUS_DOMAIN = "genius.com"

_GENIUS_HEADER_PATTERN = re.compile(
    r"^\d+\s+Contributors?$"
    r"|^Translations?$"
    r"|^[A-Z][a-záéíóúüñ]+$"
    r"|^.+\s+Lyrics$",
    re.IGNORECASE,
)


def _normalize_host(hostname: str) -> str:
    """Strip 'www.' prefix so all lookups use the bare domain."""
    return hostname.lower().removeprefix("www.")


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


@dataclass
class _FetchedPage:
    hostname: str
    soup: BeautifulSoup
    text: str


def _validate_and_fetch(url: str, *, genius_only: bool = False) -> _FetchedPage:
    """Validate a URL, apply security checks, and return a parsed BeautifulSoup page.

    Raises ValueError with a user-safe message on any failure.
    """
    if not (url or "").strip():
        raise ValueError("URL is required.")

    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError(_USER_SAFE_INVALID_URL)
    if _hostname_is_blocked(parsed.hostname):
        raise ValueError(_USER_SAFE_INVALID_URL)

    hostname = _normalize_host(parsed.hostname or "")

    if genius_only and hostname != _GENIUS_DOMAIN:
        raise ValueError(_USER_SAFE_GENIUS_ONLY)

    try:
        response = requests.get(
            url.strip(),
            timeout=10,
            headers={"User-Agent": "LingrooveLyricsImporter/1.0"},
            allow_redirects=True,
        )
        response.raise_for_status()
    except requests.RequestException:
        logger.warning("URL fetch failed: %s", url, exc_info=True)
        raise ValueError(_USER_SAFE_FETCH_FAILED) from None

    soup = BeautifulSoup(response.content, "html.parser")
    return _FetchedPage(hostname=hostname, soup=soup, text=response.text)


def _strip_genius_header(text: str) -> str:
    """Remove Genius metadata lines that appear before the actual lyrics."""
    lines = text.splitlines()
    while lines and _GENIUS_HEADER_PATTERN.match(lines[0].strip()):
        lines.pop(0)
    return "\n".join(lines).strip()


def _strip_lyrics_suffix(text: str) -> str:
    return re.sub(r"\s+Lyrics\s*$", "", text, flags=re.IGNORECASE).strip()


def _extract_genius_lyrics(soup: BeautifulSoup) -> str:
    """Extract lyrics from a Genius page using the known container selector."""
    element = soup.select_one("[data-lyrics-container]")
    if element:
        text = element.get_text(separator="\n").strip()
        if text:
            return _strip_genius_header(text)
    logger.warning("Genius lyrics container not found; falling back to full page text")
    return soup.get_text(separator="\n")


def _extract_genius_artwork(soup: BeautifulSoup) -> str | None:
    """Extract song artwork URL from Genius page og:image meta tag."""
    tag = soup.find("meta", attrs={"property": "og:image"})
    if tag:
        url = (tag.get("content") or "").strip()  # type: ignore[union-attr]
        return url or None
    return None


def _parse_genius_metadata(soup: BeautifulSoup) -> tuple[str | None, str | None]:
    """Return (title, artist) from a Genius page og:title."""
    og_title_tag = soup.find("meta", attrs={"property": "og:title"})
    og_title = (og_title_tag.get("content", "") if og_title_tag else "").strip()  # type: ignore[union-attr]
    og_clean = _strip_lyrics_suffix(og_title)
    # Genius og:title format: "Artist – Song Lyrics"
    if " – " in og_clean:
        artist, song = og_clean.split(" – ", 1)
        return song.strip() or None, artist.strip() or None
    return og_clean or None, None


def fetch_song_metadata(url: str) -> tuple[str | None, str | None, str | None]:
    """Fetch a URL and return a best-effort (title, artist, artwork_url) tuple.

    Only Genius URLs will yield artwork. For non-Genius URLs, artwork is None.
    Never raises on parse failures — returns (None, None, None) if nothing useful found.
    Raises ValueError for invalid/blocked URLs or network errors.
    """
    page = _validate_and_fetch(url, genius_only=False)
    try:
        if page.hostname == _GENIUS_DOMAIN:
            title, artist = _parse_genius_metadata(page.soup)
            artwork_url = _extract_genius_artwork(page.soup)
            return title, artist, artwork_url
    except Exception:
        logger.warning("Metadata parse failed for %s", url, exc_info=True)
    return None, None, None


def import_lyrics(source_type: str, source_value: str) -> tuple[str, str | None]:
    """Import lyrics and return (lyrics_text, artwork_url).

    Only Genius URLs are accepted for URL imports.
    For raw text imports, artwork_url is always None.
    """
    if source_type == "raw":
        return source_value, None

    page = _validate_and_fetch(source_value, genius_only=True)
    lyrics = _extract_genius_lyrics(page.soup)
    artwork_url = _extract_genius_artwork(page.soup)
    return lyrics, artwork_url
