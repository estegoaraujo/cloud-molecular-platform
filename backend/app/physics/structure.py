"""
Core data structures: Atom, Structure, Trajectory.

Design choice: when we parse a PDB we keep each atom's ORIGINAL record line
verbatim alongside its numeric coordinates. Writing a trajectory frame then
means substituting only the x/y/z columns back into that template line. This
preserves every other field (element, residue, chain, occupancy, B-factor) and
guarantees the output stays a valid, viewer-friendly PDB.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
import numpy as np


# PDB is a fixed-column format (legacy punch-card heritage). Coordinates live in
# these 1-based column ranges, each 8 chars wide with 3 decimal places.
# Ref: wwPDB Atomic Coordinate Entry Format v3.30, ATOM/HETATM records.
_X_COLS = slice(30, 38)  # columns 31-38 (0-indexed 30:38)
_Y_COLS = slice(38, 46)  # columns 39-46
_Z_COLS = slice(46, 54)  # columns 47-54


@dataclass(frozen=True)
class Atom:
    """A single atom: its element, coordinates, and source PDB line template."""

    element: str
    x: float
    y: float
    z: float
    # The original ATOM/HETATM line (without trailing newline). Used as a
    # template when re-emitting frames so all non-coordinate fields survive.
    template: str = ""

    @property
    def position(self) -> np.ndarray:
        """Coordinate as a length-3 float array (Angstroms)."""
        return np.array([self.x, self.y, self.z], dtype=np.float64)


@dataclass(frozen=True)
class Structure:
    """A single molecular conformation: an ordered collection of atoms."""

    atoms: list[Atom] = field(default_factory=list)
    title: str = "ThermRad structure"

    @property
    def n_atoms(self) -> int:
        return len(self.atoms)

    def coordinates(self) -> np.ndarray:
        """Return an (N, 3) array of all atomic coordinates.

        Vectorizing the geometry lets the physics engines operate on the whole
        structure at once with NumPy instead of looping atom-by-atom.
        """
        if not self.atoms:
            return np.empty((0, 3), dtype=np.float64)
        return np.array([[a.x, a.y, a.z] for a in self.atoms], dtype=np.float64)

    def with_coordinates(self, coords: np.ndarray) -> "Structure":
        """Return a new Structure with the same atoms but new (N, 3) coords."""
        if coords.shape != (self.n_atoms, 3):
            raise ValueError(
                f"coords shape {coords.shape} != ({self.n_atoms}, 3)"
            )
        new_atoms = [
            replace(atom, x=float(c[0]), y=float(c[1]), z=float(c[2]))
            for atom, c in zip(self.atoms, coords)
        ]
        return Structure(atoms=new_atoms, title=self.title)


@dataclass(frozen=True)
class Trajectory:
    """An ordered series of conformations produced by a simulation.

    Frame 0 is, by convention, the input structure (the equilibrium starting
    point); subsequent frames show how it evolves under the applied stress.
    """

    frames: list[Structure] = field(default_factory=list)
    title: str = "ThermRad trajectory"

    @property
    def n_frames(self) -> int:
        return len(self.frames)
    