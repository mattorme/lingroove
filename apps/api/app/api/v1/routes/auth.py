import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import authenticate_user, create_access_token, get_current_user, hash_password
from app.models.models import User
from app.schemas.schemas import LoginRequest, SignupRequest, TokenResponse, UserOut

router = APIRouter()

_AVATAR_DIR = "uploads/avatars"
_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        created_at=user.created_at.isoformat(),
    )


@router.post("/auth/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        email=payload.email,
        display_name=payload.display_name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.email, payload.password)
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/auth/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return _user_out(current_user)


@router.patch("/auth/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed.")

    contents = await file.read()
    if len(contents) > _MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="Image must be under 5 MB.")

    ext = "jpg" if file.content_type == "image/jpeg" else file.content_type.split("/")[1]
    filename = f"{current_user.id}.{ext}"

    os.makedirs(_AVATAR_DIR, exist_ok=True)
    with open(os.path.join(_AVATAR_DIR, filename), "wb") as f:
        f.write(contents)

    current_user.avatar_url = f"/uploads/avatars/{filename}"
    db.commit()
    db.refresh(current_user)
    return _user_out(current_user)


@router.delete("/auth/me/avatar", response_model=UserOut)
def delete_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.avatar_url:
        path = current_user.avatar_url.lstrip("/")
        if os.path.exists(path):
            os.remove(path)
        current_user.avatar_url = None
        db.commit()
        db.refresh(current_user)
    return _user_out(current_user)
