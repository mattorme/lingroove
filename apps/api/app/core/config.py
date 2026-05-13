import logging

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

_DEFAULT_SECRET = "change-me-in-production-use-a-long-random-string"


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "postgresql+psycopg://lingroove:lingroove@localhost:5432/lingroove"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000"
    spacy_model: str = "es_core_news_md"
    translation_provider: str = "google"
    secret_key: str = _DEFAULT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @model_validator(mode="after")
    def _validate_secret_key(self) -> "Settings":
        if self.secret_key == _DEFAULT_SECRET:
            if self.app_env == "production":
                raise ValueError(
                    "SECRET_KEY must be set to a strong random value in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
            logger.warning(
                "SECRET_KEY is using the insecure default value. "
                "Set SECRET_KEY in your .env file before deploying."
            )
        return self


settings = Settings()
