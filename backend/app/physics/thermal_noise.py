"""
Mock thermal-stress engine.

WHAT IT MODELS (and what it deliberately fakes)
------------------------------------------------
Real molecular dynamics integrates Newton's equations under an interatomic
potential. That's the job of a real engine (OpenMM/ASE). This MVP mock instead
*emulates the visible consequence* of heating a molecule: atoms vibrate about
their equilibrium positions, and as temperature climbs, the vibrations grow
until the structure loses cohesion ("bonds break").

The physics intuition we borrow:
  * Equipartition / harmonic oscillator: an atom tethered by a bond of stiffness
    k behaves like a spring in a thermal bath. Its mean-square displacement obeys
        <x^2> = k_B * T / k        →        RMS amplitude ∝ sqrt(T).
    So we scale Gaussian displacement amplitude with sqrt(T).
  * Heating ramp: temperature rises linearly across the frames, so early frames
    only jitter (thermal vibration about equilibrium) while later frames diverge.
  * Destabilization as a random walk: on top of the per-frame jitter we add a
    *cumulative* Gaussian step each frame. Independent vibration alone never
    pulls an atom away for good; an accumulating random walk does — its variance
    grows with frame count, so atoms progressively wander off their lattice and
    bonds effectively snap. This is the "breaking" you see at the end.

Reduced units: temperatures and the Boltzmann constant are in arbitrary
(reduced) units chosen so displacements land in a visually useful Angstrom
range. This is a qualitative visual mock, NOT a quantitative prediction — that
distinction is exactly why the engine is swappable.
"""

from __future__ import annotations

from dataclasses import dataclass
import numpy as np

from .base import SimulationEngine
from .structure import Structure, Trajectory


@dataclass(frozen=True)
class ThermalNoiseParams:
    """Tunable knobs for the mock thermal-stress simulation."""

    n_frames: int = 50            # total frames including frame 0 (the input)
    temp_start: float = 0.02      # reduced temperature at frame 0 (nearly cold)
    temp_end: float = 1.0         # reduced temperature at the final frame (hot)
    vibration_scale: float = 0.5  # Angstrom-per-sqrt(T) for reversible jitter
    drift_scale: float = 0.35     # Angstrom-per-sqrt(T) for cumulative breaking
    boltzmann: float = 1.0        # reduced k_B (folded into the scales above)
    seed: int | None = 42         # fix for reproducibility; None = nondeterministic

    def __post_init__(self) -> None:
        if self.n_frames < 1:
            raise ValueError("n_frames must be >= 1")
        if self.temp_start < 0 or self.temp_end < 0:
            raise ValueError("temperatures must be non-negative")


class ThermalNoiseEngine(SimulationEngine):
    """Applies temperature-ramped Gaussian displacement to a structure."""

    name = "mock-thermal-noise-v1"

    def __init__(self, params: ThermalNoiseParams | None = None) -> None:
        self.params = params or ThermalNoiseParams()

    def run(self, structure: Structure) -> Trajectory:
        p = self.params
        n_atoms = structure.n_atoms

        # Equilibrium coordinates r0 — the cold, undisturbed structure. Every
        # frame is computed relative to this so frame 0 reproduces the input
        # exactly (zero displacement at the starting temperature's lower bound).
        r0 = structure.coordinates()  # (N, 3)

        # Independent RNG stream; seeding makes the whole trajectory reproducible.
        rng = np.random.default_rng(p.seed)

        # Linear heating schedule T(f) across the requested frames.
        temps = np.linspace(p.temp_start, p.temp_end, p.n_frames)

        frames: list[Structure] = []
        drift = np.zeros((n_atoms, 3), dtype=np.float64)  # accumulated random walk

        for f, temp in enumerate(temps):
            # sqrt(k_B * T): the harmonic-oscillator amplitude scaling.
            thermal_amp = np.sqrt(p.boltzmann * temp)

            if f == 0:
                # Frame 0 is the pristine equilibrium structure — no noise, so the
                # viewer starts from exactly what the user uploaded.
                coords = r0.copy()
            else:
                # Cumulative drift: one Gaussian random-walk step, scaled by the
                # current temperature. Accumulating these is what lets atoms leave
                # their equilibrium sites for good (bond breaking).
                drift_sigma = p.drift_scale * thermal_amp
                drift = drift + rng.normal(0.0, drift_sigma, size=(n_atoms, 3))

                # Reversible vibration: independent jitter about the drifted
                # center, representing thermal oscillation that doesn't accumulate.
                vib_sigma = p.vibration_scale * thermal_amp
                vibration = rng.normal(0.0, vib_sigma, size=(n_atoms, 3))

                coords = r0 + drift + vibration

            frames.append(structure.with_coordinates(coords))

        return Trajectory(
            frames=frames,
            title=f"{structure.title} — {self.name}",
        )
    