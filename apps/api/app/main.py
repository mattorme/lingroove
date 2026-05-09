from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routes.analysis import router as analysis_router
from app.api.v1.routes.anki import router as anki_router
from app.api.v1.routes.lyrics import router as lyrics_router
from app.api.v1.routes.playlists import router as playlists_router
from app.api.v1.routes.songs import router as songs_router
from app.core.config import settings

app = FastAPI(title="Lingroove API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[item.strip() for item in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(lyrics_router, prefix="/api/v1", tags=["lyrics"])
app.include_router(analysis_router, prefix="/api/v1", tags=["analysis"])
app.include_router(anki_router, prefix="/api/v1", tags=["anki"])
app.include_router(playlists_router, prefix="/api/v1", tags=["playlists"])
app.include_router(songs_router, prefix="/api/v1", tags=["songs"])


@app.get("/health")
def health():
    return {"status": "ok"}
