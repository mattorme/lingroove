import logging
from datetime import datetime, timedelta

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.models import User

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)

# Pre-computed hash used for constant-time dummy verification when a user is
# not found, preventing email-enumeration via response-time differences.
_DUMMY_HASH: bytes = bcrypt.hashpw(b"__dummy__", bcrypt.gensalt())

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid email or password",
    headers={"WWW-Authenticate": "Bearer"},
)

_TOKEN_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired token",
    headers={"WWW-Authenticate": "Bearer"},
)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def authenticate_user(db: Session, email: str, password: str) -> User:
    """Return the matching User or raise 401.

    Always runs bcrypt (real or dummy) so response time does not reveal
    whether a given email address is registered.
    """
    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.password_hash:
        # Constant-time dummy work — result is always discarded
        bcrypt.checkpw(password.encode(), _DUMMY_HASH)
        raise _CREDENTIALS_ERROR
    if not verify_password(password, user.password_hash):
        raise _CREDENTIALS_ERROR
    return user


def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire},
        settings.secret_key,
        algorithm=settings.jwt_algorithm,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        raw_sub = payload.get("sub")
        if raw_sub is None:
            raise ValueError("missing sub")
        user_id = int(raw_sub)
    except (JWTError, ValueError):
        raise _TOKEN_ERROR

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise _TOKEN_ERROR
    return user
