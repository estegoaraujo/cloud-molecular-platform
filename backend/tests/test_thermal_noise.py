"""Unit tests for the isolated thermal-noise engine (no web/storage)."""

import numpy as np

from app.physics import Structure, Atom, ThermalNoiseEngine, ThermalNoiseParams


def _lattice(n: int = 20) -> Structure:
    """A small regular lattice of carbon atoms to perturb."""
    atoms = [Atom(element="C", x=float(i), y=0.0, z=0.0) for i in range(n)]
    return Structure(atoms=atoms, title="test lattice")


def test_frame_zero_equals_input():
    s = _lattice()
    traj = ThermalNoiseEngine(ThermalNoiseParams(n_frames=10)).run(s)
    # Frame 0 must reproduce the pristine input exactly.
    assert np.allclose(traj.frames[0].coordinates(), s.coordinates())


def test_frame_count_matches_params():
    traj = ThermalNoiseEngine(ThermalNoiseParams(n_frames=50)).run(_lattice())
    assert traj.n_frames == 50


def test_determinism_with_seed():
    s = _lattice()
    a = ThermalNoiseEngine(ThermalNoiseParams(n_frames=30, seed=7)).run(s)
    b = ThermalNoiseEngine(ThermalNoiseParams(n_frames=30, seed=7)).run(s)
    for fa, fb in zip(a.frames, b.frames):
        assert np.allclose(fa.coordinates(), fb.coordinates())


def test_displacement_grows_with_heating():
    """Later frames should drift farther from equilibrium than early ones.

    This is the core qualitative behavior: as temperature ramps, the cumulative
    random walk pulls atoms progressively off their lattice (destabilization).
    """
    s = _lattice(40)
    traj = ThermalNoiseEngine(
        ThermalNoiseParams(n_frames=50, seed=1)
    ).run(s)
    r0 = s.coordinates()

    def rms(frame):
        return float(np.sqrt(np.mean(np.sum((frame.coordinates() - r0) ** 2, axis=1))))

    early = rms(traj.frames[5])
    late = rms(traj.frames[-1])
    assert late > early > 0.0
    