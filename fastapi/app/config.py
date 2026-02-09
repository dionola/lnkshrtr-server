from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = 'sqlite:///./dev.db'
    JWT_SECRET: str = 'dev-jwt-secret'
    FRONTEND_URL: str = 'http://localhost:5173'
    BCRYPT_ROUNDS: int = 10
    GOOGLE_CLIENT_ID: str = ''
    GOOGLE_CLIENT_SECRET: str = ''
    GOOGLE_CALLBACK_URL: str = ''
    REDIS_URL: str = ''
    DB_POOL_SIZE: int = 50
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 5

    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    @field_validator('BCRYPT_ROUNDS')
    @classmethod
    def min_bcrypt_rounds(cls, v: int) -> int:
        return max(4, v)


settings = Settings()
