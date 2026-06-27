"""
Trajectory storage.

The API depends on the abstract `TrajectoryStore`; `SupabaseStorage` is the
concrete implementation backed by Supabase Storage. Keeping an interface here
mirrors the physics layer's design — it makes the route testable (swap in a
fake store) and keeps Supabase specifics out of the request handler.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from ..config import Settings


@runtime_checkable
class TrajectoryStore(Protocol):
    """Anything that can persist a trajectory and hand back a download URL."""

    def resolve_user_id(self, access_token: str | None) -> str:
        """Map a Supabase JWT to a user id (or the dev fallback if absent)."""
        ...

    def save(
        self,
        *,
        user_id: str,
        sim_id: str,
        filename: str,
        data: bytes,
        content_type: str,
    ) -> tuple[str, str]:
        """Store bytes and return (object_path, signed_download_url)."""
        ...


class StorageError(RuntimeError):
    """Raised when the storage backend fails to upload or sign a URL."""


class SupabaseStorage:
    """`TrajectoryStore` backed by Supabase Storage (service-role client)."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = None  # lazily created on first use

    # -- Supabase client (lazy) -------------------------------------------
    def _get_client(self):
        if self._client is None:
            # Imported lazily so unit tests that inject a fake store never need
            # the supabase package or network access.
            from supabase import create_client

            if not self._settings.supabase_url or not self._settings.supabase_service_role_key:
                raise StorageError(
                    "Supabase is not configured (missing URL or service-role key)."
                )
            self._client = create_client(
                self._settings.supabase_url,
                self._settings.supabase_service_role_key,
            )
        return self._client

    # -- Auth --------------------------------------------------------------
    def resolve_user_id(self, access_token: str | None) -> str:
        """Verify the JWT with Supabase Auth and return the user's id.

        Verification matters: the object path encodes the owner, so we must not
        trust a client-supplied id. If no token is given (local dev), fall back
        to the configured dev namespace.
        """
        if not access_token:
            return self._settings.dev_user_id
        try:
            response = self._get_client().auth.get_user(access_token)
            user = getattr(response, "user", None)
            if user and getattr(user, "id", None):
                return user.id
        except Exception:  # noqa: BLE001 - any auth failure → treat as anonymous
            pass
        return self._settings.dev_user_id

    # -- Persistence -------------------------------------------------------
    def save(
        self,
        *,
        user_id: str,
        sim_id: str,
        filename: str,
        data: bytes,
        content_type: str,
    ) -> tuple[str, str]:
        # Object key follows the RLS convention: <user_id>/<sim_id>/<file>.
        # Even though the service-role key bypasses RLS, we honor the per-user
        # prefix so browser-side reads (which DO enforce RLS) keep working.
        path = f"{user_id}/{sim_id}/{filename}"
        bucket = self._settings.storage_bucket

        try:
            storage = self._get_client().storage.from_(bucket)
            storage.upload(
                path=path,
                file=data,
                file_options={"content-type": content_type, "upsert": "true"},
            )
            signed = storage.create_signed_url(
                path, self._settings.signed_url_expiry
            )
        except Exception as exc:  # noqa: BLE001
            raise StorageError(f"Supabase storage error: {exc}") from exc

        # supabase-py has returned this key as both 'signedURL' and 'signedUrl'
        # across versions; accept either.
        url = signed.get("signedURL") or signed.get("signedUrl") or ""
        if not url:
            raise StorageError("Storage did not return a signed URL.")
        return path, url
    