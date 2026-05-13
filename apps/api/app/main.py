import logging

from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.routes.analysis import router as analysis_router
from app.api.v1.routes.anki import router as anki_router
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.lyrics import router as lyrics_router
from app.api.v1.routes.playlists import router as playlists_router
from app.api.v1.routes.songs import router as songs_router
from app.core.config import settings

logger = logging.getLogger(__name__)

app = FastAPI(title="Lingroove API", version="0.1.0")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, RequestValidationError):
        return await request_validation_exception_handler(request, exc)
    if isinstance(exc, StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.add_middleware(
    CORSMiddleware,
    allow_origins=[item.strip() for item in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth_router, prefix="/api/v1", tags=["auth"])
app.include_router(lyrics_router, prefix="/api/v1", tags=["lyrics"])
app.include_router(analysis_router, prefix="/api/v1", tags=["analysis"])
app.include_router(anki_router, prefix="/api/v1", tags=["anki"])
app.include_router(playlists_router, prefix="/api/v1", tags=["playlists"])
app.include_router(songs_router, prefix="/api/v1", tags=["songs"])


@app.get("/health")
def health():
    return {"status": "ok"}
