import pytest

from app.services.lyrics_importer import import_lyrics


def test_import_raw():
    assert import_lyrics("raw", "hola\nmundo") == "hola\nmundo"


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost/foo",
        "https://127.0.0.1/x",
        "http://192.168.1.1/",
        "file:///etc/passwd",
        "ftp://example.com/",
    ],
)
def test_import_url_blocked(url):
    with pytest.raises(ValueError, match="http"):
        import_lyrics("url", url)


def test_validation_error_returns_422_not_500():
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    r = client.post("/api/v1/import-lyrics", json={})
    assert r.status_code == 422
    body = r.json()
    assert "detail" in body
