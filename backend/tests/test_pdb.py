"""Unit tests for PDB/XYZ parsing and trajectory writing."""

import pytest

from app.physics import ThermalNoiseEngine, ThermalNoiseParams
from app.physics.pdb import (
    parse_pdb,
    write_pdb_trajectory,
    write_xyz_trajectory,
)

# Minimal valid PDB: 3 atoms with proper fixed-column coordinate fields.
SAMPLE_PDB = """\
TITLE     TEST MOLECULE
ATOM      1  N   ALA A   1      11.104   6.134  -6.504  1.00  0.00           N
ATOM      2  CA  ALA A   1      12.560   6.087  -6.246  1.00  0.00           C
ATOM      3  C   ALA A   1      12.954   4.690  -5.793  1.00  0.00           C
END
"""


def test_parse_extracts_atoms_and_elements():
    s = parse_pdb(SAMPLE_PDB)
    assert s.n_atoms == 3
    assert [a.element for a in s.atoms] == ["N", "C", "C"]
    assert s.atoms[0].x == pytest.approx(11.104)
    assert s.atoms[0].z == pytest.approx(-6.504)


def test_parse_rejects_empty():
    with pytest.raises(ValueError):
        parse_pdb("HEADER something\nEND\n")


def test_pdb_trajectory_has_model_records_per_frame():
    s = parse_pdb(SAMPLE_PDB)
    traj = ThermalNoiseEngine(ThermalNoiseParams(n_frames=5)).run(s)
    out = write_pdb_trajectory(traj)

    assert out.count("MODEL ") == 5
    assert out.count("ENDMDL") == 5
    # Each frame should contain all three atoms.
    assert out.count("ALA A") == 15
    assert out.rstrip().endswith("END")


def test_pdb_frame_zero_coords_preserved_in_output():
    s = parse_pdb(SAMPLE_PDB)
    traj = ThermalNoiseEngine(ThermalNoiseParams(n_frames=3)).run(s)
    out = write_pdb_trajectory(traj)
    # The pristine frame-0 coordinate should appear verbatim in the output.
    assert "11.104" in out


def test_xyz_trajectory_structure():
    s = parse_pdb(SAMPLE_PDB)
    traj = ThermalNoiseEngine(ThermalNoiseParams(n_frames=4)).run(s)
    out = write_xyz_trajectory(traj)
    lines = out.splitlines()
    # Each frame = 1 count line + 1 comment + 3 atom lines = 5 lines; 4 frames.
    assert len(lines) == 4 * (2 + 3)
    assert lines[0] == "3"
    