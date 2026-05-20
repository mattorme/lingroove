import boto3
from botocore.config import Config

from app.core.config import settings


def _r2_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def upload_avatar(user_id: int, content_type: str, data: bytes) -> str:
    """Upload avatar bytes to R2 and return the public URL."""
    ext = "jpg" if content_type == "image/jpeg" else content_type.split("/")[1]
    key = f"avatars/{user_id}.{ext}"
    _r2_client().put_object(
        Bucket=settings.r2_bucket_name,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return f"{settings.r2_public_url.rstrip('/')}/{key}"


def delete_avatar(avatar_url: str) -> None:
    """Delete an avatar from R2 given its public URL."""
    prefix = settings.r2_public_url.rstrip("/") + "/"
    if not avatar_url.startswith(prefix):
        return
    key = avatar_url[len(prefix):]
    _r2_client().delete_object(Bucket=settings.r2_bucket_name, Key=key)
