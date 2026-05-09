from sqlalchemy.orm import Session

from app.models.models import User


def ensure_local_mvp_user(db: Session, user_id: int) -> None:
    if db.query(User).filter(User.id == user_id).first() is not None:
        return
    db.add(
        User(
            id=user_id,
            email=f"user{user_id}@lingroove.local",
            display_name=f"User {user_id}",
        )
    )
    db.flush()
