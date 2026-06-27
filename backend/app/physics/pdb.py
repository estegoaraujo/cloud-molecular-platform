"""
PDB / XYZ input and output.

Parsing reads ATOM/HETATM records from a `.pdb`; writing emits a multi-frame
trajectory. Two output formats are supported:

  * Multi-frame PDB using MODEL/ENDMDL records — the standard way to store an
    ensemble or trajectory in PDB, and what NGL Viewer animates frame-by-frame.
  * XYZ — a minimal element+coordinate format, handy for quick interop.

Like the rest of `physics/`, this module is pure: bytes/str in, bytes/str out,
no network or framework dependencies.
"""

from __future__ import annotations

from .structure import Atom, Structure, Trajectory

# Coordinate column spans (0-indexed slices) per the wwPDB fixed-column format.
_X = slice(30, 38)
_Y = slice(38, 46)
_Z = slice(46, 54)
_ELEMENT = slice(76, 78)  # columns 77-78


def _parse_element(line: str) -> str:
    """Best-effort element symbol from a PDB ATOM/HETATM line.

    Prefer the dedicated element columns (77-78). If absent (older/sloppy PDBs),
    fall back to the atom-name field (13-16), stripping leading digits.
    """
    if len(line) >= 78:
        elem = line[_ELEMENT].strip()
        if elem:
            return elem.capitalize()
    name = line[12:16].strip()
    # Atom names like "1HG1" or "CA" — drop leading digits, take leading letters.
    letters = "".join(c for c in name if c.isalpha())
    return (letters[:2] or "X").capitalize()


def parse_pdb(text: str) -> Structure:
    """Parse PDB text into a Structure.

    Only the first model is read (frame 0 / the equilibrium structure); any
    MODEL/ENDMDL wrapping in a multi-model input is ignored beyond the first.
    """
    atoms: list[Atom] = []
    title = "ThermRad structure"
    seen_endmdl = False

    for raw in text.splitlines():
        record = raw[:6].strip()

        if record == "TITLE":
            title = raw[10:].strip() or title
            continue

        # Stop collecting once the first model ends, so we seed from one frame.
        if record == "ENDMDL":
            seen_endmdl = True
            continue
        if seen_endmdl:
            continue

        if record in ("ATOM", "HETATM"):
            # Pad short lines so the fixed-column slices never IndexError.
            line = raw.ljust(80)
            try:
                x = float(line[_X])
                y = float(line[_Y])
                z = float(line[_Z])
            except ValueError:
                # Malformed coordinate columns — skip this atom rather than crash.
                continue
            atoms.append(
                Atom(element=_parse_element(line), x=x, y=y, z=z, template=line)
            )

    if not atoms:
        raise ValueError("No ATOM/HETATM records found in PDB input.")

    return Structure(atoms=atoms, title=title)


def _format_coord(value: float) -> str:
    """Format a coordinate into PDB's 8-wide, 3-decimal field.

    PDB columns physically cannot hold |value| >= 10000.000; clamp to keep the
    output well-formed even if the mock flings an atom very far during breaking.
    """
    clamped = max(-9999.999, min(9999.999, value))
    return f"{clamped:8.3f}"


def _atom_line_with_coords(atom: Atom) -> str:
    """Rewrite an atom's template line with its current coordinates."""
    line = atom.template if atom.template else _synthetic_template(atom)
    line = line.ljust(80)
    line = (
        line[:30]
        + _format_coord(atom.x)
        + _format_coord(atom.y)
        + _format_coord(atom.z)
        + line[54:]
    )
    return line.rstrip()


def _synthetic_template(atom: Atom) -> str:
    """Build a minimal valid ATOM line when no original template exists."""
    elem = atom.element.upper()[:2]
    # serial/name/resName/chain/resSeq filled with reasonable placeholders.
    return (
        f"ATOM      1  {elem:<3} MOL A   1    "
        f"{atom.x:8.3f}{atom.y:8.3f}{atom.z:8.3f}"
        f"  1.00  0.00          {elem:>2}"
    )


def write_pdb_trajectory(trajectory: Trajectory) -> str:
    """Serialize a Trajectory as a multi-frame PDB (MODEL/ENDMDL per frame)."""
    out: list[str] = []
    if trajectory.title:
        out.append(f"TITLE     {trajectory.title}"[:80])

    for i, frame in enumerate(trajectory.frames, start=1):
        # MODEL serial is right-justified to width 4 starting at column 11.
        out.append(f"MODEL     {i:>4}")
        for atom in frame.atoms:
            out.append(_atom_line_with_coords(atom))
        out.append("ENDMDL")

    out.append("END")
    return "\n".join(out) + "\n"


def write_xyz_trajectory(trajectory: Trajectory) -> str:
    """Serialize a Trajectory as a concatenated multi-frame XYZ file."""
    out: list[str] = []
    for i, frame in enumerate(trajectory.frames):
        out.append(str(frame.n_atoms))
        out.append(f"frame {i} | {trajectory.title}")
        for atom in frame.atoms:
            out.append(
                f"{atom.element:<2} {atom.x:12.6f} {atom.y:12.6f} {atom.z:12.6f}"
            )
    return "\n".join(out) + "\n"
