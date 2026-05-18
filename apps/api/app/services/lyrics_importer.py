import ipaddress
import json
import logging
import re
from dataclasses import dataclass
from urllib.parse import urlparse

import requests
import trafilatura
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_USER_SAFE_FETCH_FAILED = "Could not fetch lyrics from that URL."
_USER_SAFE_INVALID_URL = "Only http(s) URLs are allowed for lyrics import."

# Sites that cannot be scraped server-side (JS-rendered or bot-protected WAF).
# Keys use bare domains (no www.) — matched via _normalize_host().
_UNSUPPORTED_SITES: dict[str, str] = {
    "musixmatch.com": "Musixmatch renders lyrics with JavaScript and cannot be scraped. Try genius.com or azlyrics.com instead.",
    "letras.com": "letras.com blocks automated requests. Try genius.com or azlyrics.com instead.",
    "letras.mus.br": "letras.mus.br blocks automated requests. Try genius.com or azlyrics.com instead.",
}

# CSS selectors for known lyrics sites, tried before the generic fallback.
# Keys use bare domains (no www.) — matched via _normalize_host().
_SITE_SELECTORS: dict[str, list[str]] = {
    "genius.com": ["[data-lyrics-container]"],
    "azlyrics.com": [".ringtone ~ div", ".col-xs-12.col-lg-8.text-center > div:not([class])"],
    "lyrics.com": ["#lyric-body-text"],
    "songlyrics.com": ["#songLyricsDiv"],
    "metrolyrics.com": ["#lyrics-body-text"],
}


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


_GENIUS_HEADER_PATTERN = re.compile(
    r"^\d+\s+Contributors?$"   # e.g. "9 Contributors"
    r"|^Translations?$"         # "Translations"
    r"|^[A-Z][a-záéíóúüñ]+$"   # single capitalised word — language names like "English", "Spanish"
    r"|^.+\s+Lyrics$",          # "Marlboro Rojo Lyrics" — Genius song title header
    re.IGNORECASE,
)


def _strip_genius_header(text: str) -> str:
    """Remove Genius metadata lines that appear before the actual lyrics."""
    lines = text.splitlines()
    while lines and _GENIUS_HEADER_PATTERN.match(lines[0].strip()):
        lines.pop(0)
    return "\n".join(lines).strip()


# AZLyrics appends footer content after the lyrics. Everything from the first
# of these markers onwards is boilerplate and should be dropped.
_AZLYRICS_FOOTER_MARKERS = re.compile(
    r"^Submit Corrections$"
    r"|^Writer\(s\):",
    re.IGNORECASE,
)


def _strip_azlyrics_footer(text: str) -> str:
    """Truncate at the first AZLyrics footer marker."""
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if _AZLYRICS_FOOTER_MARKERS.match(line.strip()):
            lines = lines[:i]
            break
    return "\n".join(lines).strip()


def _extract_with_site_selectors(soup: BeautifulSoup, hostname: str) -> str | None:
    selectors = _SITE_SELECTORS.get(hostname, [])
    for selector in selectors:
        # Take only the first matching element — subsequent siblings on AZLyrics
        # and similar sites can be footer/recommendation divs.
        element = soup.select_one(selector)
        if element:
            text = element.get_text(separator="\n").strip()
            if not text:
                continue
            if hostname == "genius.com":
                text = _strip_genius_header(text)
            elif hostname == "azlyrics.com":
                text = _strip_azlyrics_footer(text)
            return text
    return None


def _extract_with_trafilatura(html: str) -> str | None:
    """Use trafilatura to extract the main body text, stripping boilerplate."""
    text = trafilatura.extract(
        html,
        include_comments=False,
        include_tables=False,
        no_fallback=False,
    )
    return text.strip() if text else None


@dataclass
class _FetchedPage:
    hostname: str
    soup: BeautifulSoup
    text: str


def _validate_and_fetch(url: str, *, check_unsupported: bool = True) -> _FetchedPage:
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

    if check_unsupported:
        unsupported_error = _UNSUPPORTED_SITES.get(hostname)
        if unsupported_error:
            raise ValueError(unsupported_error)

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


def _strip_lyrics_suffix(text: str) -> str:
    return re.sub(r"\s+Lyrics\s*$", "", text, flags=re.IGNORECASE).strip()


def _parse_json_ld(soup: BeautifulSoup) -> tuple[str | None, str | None]:
    """Extract title and artist from schema.org JSON-LD (most reliable source)."""
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            if item.get("@type") not in ("MusicRecording", "MusicComposition", "Song"):
                continue
            song_title = item.get("name", "").strip() or None
            artist_data = item.get("byArtist") or item.get("artist")
            artist_name: str | None = None
            if isinstance(artist_data, dict):
                artist_name = artist_data.get("name", "").strip() or None
            elif isinstance(artist_data, list) and artist_data:
                first = artist_data[0]
                artist_name = (first.get("name", "").strip() if isinstance(first, dict) else str(first).strip()) or None
            elif isinstance(artist_data, str):
                artist_name = artist_data.strip() or None
            if song_title:
                return song_title, artist_name
    return None, None


def _parse_song_metadata(soup: BeautifulSoup, hostname: str) -> tuple[str | None, str | None]:
    """Return (title, artist) from page metadata.

    Priority:
    1. JSON-LD schema.org structured data  — explicitly labelled title/artist
    2. Site-specific <title> patterns      — Genius, AZLyrics
    3. og:title as song anchor             — compare against page title halves
    """
    # 1. JSON-LD — most reliable, explicitly labelled
    title, artist = _parse_json_ld(soup)
    if title:
        return title, artist

    og_title_tag = soup.find("meta", attrs={"property": "og:title"})
    og_title = (og_title_tag.get("content", "") if og_title_tag else "").strip()  # type: ignore[union-attr]
    page_title_tag = soup.find("title")
    page_title = (page_title_tag.get_text() if page_title_tag else "").strip()

    # 2. Site-specific patterns
    if hostname == "genius.com":
        # Genius og:title is "Artist – Song Lyrics" or just "Song Lyrics"
        og_clean = _strip_lyrics_suffix(og_title)
        if " – " in og_clean:
            og_artist, og_song = og_clean.split(" – ", 1)
            title = og_song.strip() or None
            artist = og_artist.strip() or None
        else:
            title = og_clean or None
        return title, artist

    if hostname == "azlyrics.com":
        m = re.match(r"^(.+?)\s*-\s*(.+?)\s+LYRICS\s*$", page_title, re.IGNORECASE)
        if m:
            return m.group(2).strip().title(), m.group(1).strip().title()

    # 3. og:title is the song name on most lyric sites.
    #    Compare it against each half of the page title to find which half is the artist.
    song_from_og = _strip_lyrics_suffix(og_title) if og_title else None
    clean_page = re.sub(r"\s*\|.*$", "", page_title).strip()

    for sep in (" – ", " - ", " | ", ": "):
        if sep not in clean_page:
            continue
        left, right = (_strip_lyrics_suffix(s.strip()) for s in clean_page.split(sep, 1))
        if song_from_og:
            if right.lower() == song_from_og.lower():
                return right or None, left or None      # "Artist – Song"
            if left.lower() == song_from_og.lower():
                return left or None, right or None      # "Song – Artist"
        # Separator found but og:title doesn't match either side — don't guess
        break

    return song_from_og or (_strip_lyrics_suffix(clean_page) or None), None


def fetch_song_metadata(url: str) -> tuple[str | None, str | None]:
    """Fetch a URL and return a best-effort (title, artist) pair from the page.

    Never raises on parse failures — returns (None, None) if nothing useful is found.
    Raises ValueError for invalid/blocked URLs or network errors.
    """
    page = _validate_and_fetch(url, check_unsupported=False)
    try:
        return _parse_song_metadata(page.soup, page.hostname)
    except Exception:
        logger.warning("Metadata parse failed for %s", url, exc_info=True)
        return None, None


def import_lyrics(source_type: str, source_value: str) -> str:
    if source_type == "raw":
        return source_value

    page = _validate_and_fetch(source_value, check_unsupported=True)

    text = _extract_with_site_selectors(page.soup, page.hostname)
    if text:
        logger.debug("Lyrics extracted via site selector for %s", page.hostname)
        return text

    text = _extract_with_trafilatura(page.text)
    if text:
        logger.debug("Lyrics extracted via trafilatura for %s", page.hostname)
        return text

    # Last resort: plain text dump. Unlikely to be reached in practice.
    logger.warning("Falling back to raw get_text() for %s", page.hostname)
    return page.soup.get_text(separator="\n")
