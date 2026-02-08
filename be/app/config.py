from functools import lru_cache
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Masquerade API"
    api_prefix: str = "/api"
    frontend_origin: str = "http://localhost:5173"
    frontend_origins: str = ""
    public_base_url: str = ""
    solana_cluster: str = "devnet"
    solana_rpc_url: str = "https://api.devnet.solana.com"
    marketplace_authority_secret: str = ""
    marketplace_listing_lock_ttl_seconds: int = 180

    def get_cors_origins(self) -> list[str]:
        raw_origins = [self.frontend_origin]
        if self.frontend_origins.strip():
            raw_origins.extend(self.frontend_origins.split(","))

        normalized: list[str] = []
        seen: set[str] = set()

        for origin in raw_origins:
            cleaned = origin.strip().rstrip("/")
            if not cleaned:
                continue
            if cleaned not in seen:
                seen.add(cleaned)
                normalized.append(cleaned)

            parsed = urlparse(cleaned)
            if parsed.scheme not in {"http", "https"}:
                continue

            if parsed.hostname == "localhost":
                alias = f"{parsed.scheme}://127.0.0.1"
                if parsed.port:
                    alias = f"{alias}:{parsed.port}"
                if alias not in seen:
                    seen.add(alias)
                    normalized.append(alias)
            elif parsed.hostname == "127.0.0.1":
                alias = f"{parsed.scheme}://localhost"
                if parsed.port:
                    alias = f"{alias}:{parsed.port}"
                if alias not in seen:
                    seen.add(alias)
                    normalized.append(alias)

        return normalized


@lru_cache
def get_settings() -> Settings:
    return Settings()
