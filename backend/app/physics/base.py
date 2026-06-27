"""
The engine contract.

Every physics backend — the MVP mock, or a future OpenMM / ASE / Geant4
integration — implements `SimulationEngine`. The API layer depends only on this
abstract type, so swapping engines is a one-line change at the call site and
requires zero changes to routes, storage, or serialization.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from .structure import Structure, Trajectory


class SimulationEngine(ABC):
    """Abstract base for anything that turns a Structure into a Trajectory."""

    #: Human-readable identifier, surfaced in API responses for provenance.
    name: str = "abstract"

    @abstractmethod
    def run(self, structure: Structure) -> Trajectory:
        """Simulate stress on `structure` and return the resulting Trajectory.

        Implementations must:
          - treat the input as immutable (return new Structures, never mutate),
          - place the unperturbed input as frame 0,
          - be deterministic when a seed is provided (for reproducibility).
        """
        raise NotImplementedError
    