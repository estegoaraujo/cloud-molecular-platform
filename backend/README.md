# ThermRad Backend — Physics API

FastAPI service that runs thermal-stress simulations on molecular structures and
stores the resulting trajectories in Supabase.

## Stack

- **FastAPI** + **uvicorn**
- **NumPy** physics engine (mock thermal noise for the MVP)
- **Supabase** Storage (service-role) for trajectory persistence

## Layout

```
backend/
├── app/
│   ├── main.py              # FastAPI app + CORS
│   ├── config.py            # env-driven settings
│   ├── schemas.py           # response models
│   ├── api/
│   │   ├── deps.py          # dependency providers (overridable in tests)
│   │   └── routes/simulate.py   # POST /simulate/thermal
│   ├── physics/             # ISOLATED, framework-free core
│   │   ├── structure.py     # Atom / Structure / Trajectory
│   │   ├── base.py          # SimulationEngine interface
│   │   ├── thermal_noise.py # mock engine (Gaussian thermal displacement)
│   │   └── pdb.py           # PDB parse + multi-frame PDB/XYZ writers
│   └── services/storage.py  # TrajectoryStore + SupabaseStorage
└── tests/                   # engine, PDB, and endpoint tests
```

The `physics/` package has **no** FastAPI or Supabase imports. To swap the mock
for OpenMM/ASE/Geant4, implement `SimulationEngine.run()` in a new module and
construct it in `routes/simulate.py` — nothing else changes.

## Setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in Supabase URL + service-role key
uvicorn app.main:app --reload --port 8000
```

Docs at `http://localhost:8000/docs`, health at `http://localhost:8000/health`.

## Endpoint

`POST /simulate/thermal` (multipart/form-data)

| Field           | Type   | Default | Notes                              |
| --------------- | ------ | ------- | ---------------------------------- |
| `file`          | file   | —       | `.pdb` structure (required)        |
| `n_frames`      | int    | 50      | trajectory length (2-500)          |
| `temp_start`    | float  | 0.02    | reduced temperature at frame 0     |
| `temp_end`      | float  | 1.0     | reduced temperature at final frame |
| `seed`          | int    | 42      | RNG seed for reproducibility       |
| `output_format` | string | pdb     | `pdb` or `xyz`                     |

Send the Supabase access token as `Authorization: Bearer <jwt>` so output is
namespaced under the real user (`<user_id>/<sim_id>/trajectory.pdb`). Without a
token, output falls back to the `DEV_USER_ID` namespace (local dev only).

## Tests

```bash
pip install -r requirements-dev.txt
pytest          # engine + PDB + endpoint tests (no network needed)
```
