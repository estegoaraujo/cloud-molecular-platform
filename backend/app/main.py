"""
FastAPI application entrypoint.

Wires CORS (so the Next.js frontend can call us cross-origin) and mounts the
simulation router. Run locally with:

    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import simulate
from .config import get_settings

settings = get_settings()

app = FastAPI(
    title="ThermRad Physics API",
    version="0.1.0",
    description="Thermal & radiation stress simulation for molecular structures.",
)

# CORS: the browser blocks cross-origin requests unless the server opts in.
# We allow exactly the configured frontend origins, plus the methods/headers
# the dashboard needs (POST with an Authorization bearer token).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(simulate.router)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    """Liveness probe used by uptime checks and the frontend's status panel."""
    return {"status": "ok", "service": "thermrad-physics"}
