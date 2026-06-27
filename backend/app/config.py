"""
Application settings.

Configuration is read from environment variables (or a local .env). Secrets —
above all the Supabase SERVICE ROLE key — live only here on the backend and are
never exposed to the browser.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # ── Supabase ──────────────────────────────────────────────────────────
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    # Service-role key bypasses RLS; required to write trajectories server-side.
    supabase_service_role_key: str = Field(
        default="", alias="SUPABASE_SERVICE_ROLE_KEY"
    )
    storage_bucket: str = Field(
        default="molecular-simulations", alias="STORAGE_BUCKET"
    )
    # Lifetime (seconds) of the signed download URL returned to the browser.
    signed_url_expiry: int = Field(default=3600, alias="SIGNED_URL_EXPIRY")

    # ── CORS ──────────────────────────────────────────────────────────────
    # Comma-separated list of allowed frontend origins.
    cors_origins: str = Field(
        default="http://localhost:3000", alias="CORS_ORIGINS"
    )

    # ── Dev fallback ──────────────────────────────────────────────────────
    # When no valid auth token is supplied (local testing), trajectories are
    # namespaced under this id. NEVER rely on this in production.
    dev_user_id: str = Field(default="dev-anonymous", alias="DEV_USER_ID")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton (read the environment once)."""
    return Settings()
