"""Pydantic schemas for API responses."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SimulationResponse(BaseModel):
    """Returned by POST /simulate/thermal after a successful run."""

    simulation_id: str = Field(..., description="Unique id for this run")
    engine: str = Field(..., description="Engine that produced the trajectory")
    n_atoms: int = Field(..., description="Atoms in the parsed structure")
    n_frames: int = Field(..., description="Frames in the output trajectory")
    output_format: str = Field(..., description="'pdb' or 'xyz'")
    storage_path: str = Field(..., description="Object key in the storage bucket")
    file_url: str = Field(..., description="Signed URL to download the trajectory")
    expires_in: int = Field(..., description="Signed URL lifetime in seconds")
    