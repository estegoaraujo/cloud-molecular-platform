"""
Thermal-stress simulation endpoint.

Flow: receive an uploaded .pdb → parse it → run the (swappable) thermal engine
→ serialize the trajectory → upload to Supabase Storage → return a signed URL.
The handler stays thin; all the real work lives in `physics/` and `services/`.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile

from ...config import Settings
from ...physics import ThermalNoiseEngine, ThermalNoiseParams
from ...physics.pdb import parse_pdb, write_pdb_trajectory, write_xyz_trajectory
from ...schemas import SimulationResponse
from ...services.storage import StorageError, TrajectoryStore
from ..deps import get_app_settings, get_storage

router = APIRouter(prefix="/simulate", tags=["simulate"])

# Upload guard: parsing is cheap, but reject obviously oversized payloads early.
_MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB

_FORMATS = {
    "pdb": ("trajectory.pdb", "chemical/x-pdb", write_pdb_trajectory),
    "xyz": ("trajectory.xyz", "text/plain", write_xyz_trajectory),
}


@router.post("/thermal", response_model=SimulationResponse)
async def simulate_thermal(
    file: Annotated[UploadFile, File(description="Molecular structure (.pdb)")],
    storage: Annotated[TrajectoryStore, Depends(get_storage)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    # Simulation knobs (sensible defaults → 50-frame heating ramp).
    n_frames: Annotated[int, Form(ge=2, le=500)] = 50,
    temp_start: Annotated[float, Form(ge=0.0)] = 0.02,
    temp_end: Annotated[float, Form(ge=0.0)] = 1.0,
    seed: Annotated[int | None, Form()] = 42,
    output_format: Annotated[str, Form()] = "pdb",
    # Supabase access token; used to namespace output under the real user.
    authorization: Annotated[str | None, Header()] = None,
) -> SimulationResponse:
    fmt = output_format.lower()
    if fmt not in _FORMATS:
        raise HTTPException(400, f"output_format must be one of {list(_FORMATS)}")

    if not (file.filename or "").lower().endswith(".pdb"):
        raise HTTPException(400, "Upload must be a .pdb file.")

    raw = await file.read()
    if len(raw) > _MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Uploaded file exceeds the 25 MB limit.")

    try:
        text = raw.decode("utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        raise HTTPException(400, "Could not read the uploaded file as text.")

    # --- Parse ---------------------------------------------------------------
    try:
        structure = parse_pdb(text)
    except ValueError as exc:
        raise HTTPException(422, f"Invalid PDB: {exc}") from exc

    # --- Simulate (isolated, swappable engine) ------------------------------
    params = ThermalNoiseParams(
        n_frames=n_frames, temp_start=temp_start, temp_end=temp_end, seed=seed
    )
    engine = ThermalNoiseEngine(params)
    trajectory = engine.run(structure)

    # --- Serialize -----------------------------------------------------------
    filename, content_type, writer = _FORMATS[fmt]
    payload = writer(trajectory).encode("utf-8")

    # --- Persist -------------------------------------------------------------
    user_id = storage.resolve_user_id(_bearer(authorization))
    sim_id = uuid.uuid4().hex
    try:
        path, url = storage.save(
            user_id=user_id,
            sim_id=sim_id,
            filename=filename,
            data=payload,
            content_type=content_type,
        )
    except StorageError as exc:
        raise HTTPException(502, str(exc)) from exc

    return SimulationResponse(
        simulation_id=sim_id,
        engine=engine.name,
        n_atoms=structure.n_atoms,
        n_frames=trajectory.n_frames,
        output_format=fmt,
        storage_path=path,
        file_url=url,
        expires_in=settings.signed_url_expiry,
    )


def _bearer(authorization: str | None) -> str | None:
    """Extract the token from an 'Authorization: Bearer <token>' header."""
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None
