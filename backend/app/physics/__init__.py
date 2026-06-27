"""
Physics layer for ThermRad.

This package is deliberately self-contained: it has NO dependency on FastAPI,
Supabase, or any web/IO concern. It speaks only in terms of molecular
structures and trajectories. That isolation is what lets us swap the mock MVP
engine for a real one (OpenMM, ASE, Geant4) later without touching API code.

Public surface:
    Structure          - a single molecular conformation (atoms + coordinates)
    Trajectory         - an ordered series of Structures (the simulation output)
    SimulationEngine   - the abstract interface every engine implements
    ThermalNoiseEngine - the MVP mock engine (Gaussian thermal displacement)
"""

from .structure import Atom, Structure, Trajectory
from .base import SimulationEngine
from .thermal_noise import ThermalNoiseEngine, ThermalNoiseParams

__all__ = [
    "Atom",
    "Structure",
    "Trajectory",
    "SimulationEngine",
    "ThermalNoiseEngine",
    "ThermalNoiseParams",
]
