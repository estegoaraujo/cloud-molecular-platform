"""
FastAPI dependency providers.

Centralizing these makes the route declarative and, crucially, overridable in
tests: a test can swap `get_storage` for a fake `TrajectoryStore` via
`app.dependency_overrides` and exercise the endpoint with zero network access.
"""

from __future__ import annotations

from functools import lru_cache

from ..config import Settings, get_settings
from ..services.storage import SupabaseStorage, TrajectoryStore


@lru_cache
def _storage_singleton() -> SupabaseStorage:
    return SupabaseStorage(get_settings())


def get_storage() -> TrajectoryStore:
    """Provide the configured trajectory store (Supabase by default)."""
    return _storage_singleton()


def get_app_settings() -> Settings:
    return get_settings()
