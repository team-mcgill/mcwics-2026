from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Masquerade API"
    api_prefix: str = "/api"
    frontend_origin: str = "http://localhost:5173"
    solana_cluster: str = "devnet"
    solana_rpc_url: str = "https://api.devnet.solana.com"
    marketplace_authority_secret: str = ""
    marketplace_listing_lock_ttl_seconds: int = 180


@lru_cache
def get_settings() -> Settings:
    return Settings()
