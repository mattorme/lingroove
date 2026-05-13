from pydantic import BaseModel, Field


class ImportLyricsRequest(BaseModel):
    sourceType: str = Field(pattern="^(url|raw)$")
    sourceValue: str
    title: str = "Untitled Song"
    artist: str | None = None
    userId: int


class ImportLyricsResponse(BaseModel):
    songId: int
    lyricId: int
    cleanedLyrics: str
    detectedLanguage: str


class AnalyzeLyricsRequest(BaseModel):
    songId: int


class VocabularyOut(BaseModel):
    id: int
    originalWord: str
    infinitiveForm: str | None
    englishTranslation: str
    contextSentence: str
    partOfSpeech: str
    isSelected: bool


class AnalyzeLyricsResponse(BaseModel):
    songId: int
    cleanedLyrics: str
    grouped: dict[str, list[VocabularyOut]]
    entries: list[VocabularyOut]


class CreatePlaylistRequest(BaseModel):
    userId: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None


class RenamePlaylistRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class PlaylistCreateResponse(BaseModel):
    id: int
    userId: int
    name: str
    description: str | None


class PlaylistSongOut(BaseModel):
    songId: int
    title: str
    artist: str | None


class PlaylistResponse(BaseModel):
    id: int
    name: str
    description: str | None
    songs: list[PlaylistSongOut]
    vocabularyCount: int


class GenerateAnkiRequest(BaseModel):
    songId: int
    selectedVocabularyIds: list[int]


class SongSummary(BaseModel):
    id: int
    title: str
    artist: str | None
    sourceType: str
    createdAt: str


class SongListResponse(BaseModel):
    songs: list[SongSummary]


class PlaylistSummary(BaseModel):
    id: int
    name: str
    description: str | None
    songCount: int


class PlaylistListResponse(BaseModel):
    playlists: list[PlaylistSummary]


class AddSongToPlaylistRequest(BaseModel):
    songId: int = Field(ge=1)
