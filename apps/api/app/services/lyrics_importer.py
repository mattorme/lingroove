import ipaddress
import logging
import re
from urllib.parse import urlparse

import requests
import trafilatura
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_USER_SAFE_FETCH_FAILED = "Could not fetch lyrics from that URL."
_USER_SAFE_INVALID_URL = "Only http(s) URLs are allowed for lyrics import."

# Sites that cannot be scraped server-side (JS-rendered or bot-protected WAF).
# Users are shown a friendly error with suggested alternatives.
_UNSUPPORTED_SITES: dict[str, str] = {
    "musixmatch.com": "Musixmatch renders lyrics with JavaScript and cannot be scraped. Try genius.com or azlyrics.com instead.",
    "www.musixmatch.com": "Musixmatch renders lyrics with JavaScript and cannot be scraped. Try genius.com or azlyrics.com instead.",
    "letras.com": "letras.com blocks automated requests. Try genius.com or azlyrics.com instead.",
    "www.letras.com": "letras.com blocks automated requests. Try genius.com or azlyrics.com instead.",
    "letras.mus.br": "letras.mus.br blocks automated requests. Try genius.com or azlyrics.com instead.",
    "www.letras.mus.br": "letras.mus.br blocks automated requests. Try genius.com or azlyrics.com instead.",
}

# CSS selectors for known lyrics sites, tried before the generic fallback.
# Each entry maps a hostname to an ordered list of selectors to attempt.
_SITE_SELECTORS: dict[str, list[str]] = {
    "genius.com": ["[data-lyrics-container]"],
    "www.genius.com": ["[data-lyrics-container]"],
    "azlyrics.com": [".ringtone ~ div", ".col-xs-12.col-lg-8.text-center > div:not([class])"],
    "www.azlyrics.com": [".ringtone ~ div", ".col-xs-12.col-lg-8.text-center > div:not([class])"],
    "lyrics.com": ["#lyric-body-text"],
    "www.lyrics.com": ["#lyric-body-text"],
    "songlyrics.com": ["#songLyricsDiv"],
    "www.songlyrics.com": ["#songLyricsDiv"],
    "metrolyrics.com": ["#lyrics-body-text"],
    "www.metrolyrics.com": ["#lyrics-body-text"],
}


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
            if hostname in ("genius.com", "www.genius.com"):
                text = _strip_genius_header(text)
            elif hostname in ("azlyrics.com", "www.azlyrics.com"):
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

    unsupported_error = _UNSUPPORTED_SITES.get(parsed.hostname or "")
    if unsupported_error:
        raise ValueError(unsupported_error)

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

    hostname = parsed.hostname or ""
    # Use raw bytes so BeautifulSoup reads the charset from the HTML <meta> tag
    # rather than relying on requests' charset guessing, which can produce mojibake
    # on pages served without an explicit Content-Type charset header.
    soup = BeautifulSoup(response.content, "html.parser")

    text = _extract_with_site_selectors(soup, hostname)
    if text:
        logger.debug("Lyrics extracted via site selector for %s", hostname)
        return text

    text = _extract_with_trafilatura(response.text)
    if text:
        logger.debug("Lyrics extracted via trafilatura for %s", hostname)
        return text

    # Last resort: plain text dump. Unlikely to be reached in practice.
    logger.warning("Falling back to raw get_text() for %s", hostname)
    return soup.get_text(separator="\n")
