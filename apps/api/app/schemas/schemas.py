from pydantic import BaseModel, EmailStr, Field, field_validator

# bcrypt silently truncates passwords longer than 72 bytes.
# Reject anything over that limit so users are never surprised.
_BCRYPT_MAX_BYTES = 72


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class SignupRequest(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=_BCRYPT_MAX_BYTES)

    @field_validator("display_name")
    @classmethod
    def display_name_not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("display_name must not be blank")
        return stripped

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, v: str) -> str:
        if len(v.encode()) > _BCRYPT_MAX_BYTES:
            raise ValueError(f"password must be at most {_BCRYPT_MAX_BYTES} characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    display_name: str
    created_at: str


# ---------------------------------------------------------------------------
# Lyrics / Songs
# ---------------------------------------------------------------------------

class ImportLyricsRequest(BaseModel):
    sourceType: str = Field(pattern="^(url|raw)$")
    sourceValue: str
    title: str = "Untitled Song"
    artist: str | None = None


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
    conjugatedTranslation: str | None = None
    contextSentence: str
    partOfSpeech: str
    isSelected: bool

    @classmethod
    def from_orm_row(cls, row: object) -> "VocabularyOut":
        return cls(
            id=row.id,
            originalWord=row.original_word,
            infinitiveForm=row.infinitive_form,
            englishTranslation=row.english_translation,
            conjugatedTranslation=row.conjugated_translation,
            contextSentence=row.context_line,
            partOfSpeech=row.part_of_speech,
            isSelected=row.is_selected,
        )


class AnalyzeLyricsResponse(BaseModel):
    songId: int
    cleanedLyrics: str
    grouped: dict[str, list[VocabularyOut]]
    entries: list[VocabularyOut]


class SongSummary(BaseModel):
    id: int
    title: str
    artist: str | None
    artworkUrl: str | None
    sourceType: str
    createdAt: str


class SongListResponse(BaseModel):
    songs: list[SongSummary]


# ---------------------------------------------------------------------------
# Playlists
# ---------------------------------------------------------------------------

class CreatePlaylistRequest(BaseModel):
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
    artworkUrl: str | None


class PlaylistResponse(BaseModel):
    id: int
    name: str
    description: str | None
    songs: list[PlaylistSongOut]
    vocabularyCount: int


class PlaylistSummary(BaseModel):
    id: int
    name: str
    description: str | None
    songCount: int
    artworkUrls: list[str]


class PlaylistListResponse(BaseModel):
    playlists: list[PlaylistSummary]


class AddSongToPlaylistRequest(BaseModel):
    songId: int = Field(ge=1)


# ---------------------------------------------------------------------------
# Anki
# ---------------------------------------------------------------------------

class GenerateAnkiRequest(BaseModel):
    songId: int
    selectedVocabularyIds: list[int]
