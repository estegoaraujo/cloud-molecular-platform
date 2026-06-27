# CLAUDE.md — ThermRad

Project memory for Claude Code. Read this first. Per-package detail lives in
`README.md`, `frontend/README.md`, `backend/README.md`, `supabase/README.md` —
prefer those over re-deriving from code.

## What this is

ThermRad is a cloud platform that simulates extreme **thermal and radiation
stress on molecular structures**. A researcher signs in, uploads a `.pdb`,
triggers a backend physics simulation, and watches the structure destabilize in
the browser as an animated trajectory.

Monorepo, three deployables:
- `frontend/` — Next.js (TypeScript, Tailwind, React), Supabase auth, 3D viewer
- `backend/` — FastAPI physics API (Python, NumPy)
- `supabase/` — database & storage as code (SQL migrations)

## Build status

- [x] **Step 1** — Monorepo, Supabase email/password auth, protected dashboard,
  `molecular-simulations` storage bucket with per-user RLS.
- [x] **Step 2** — FastAPI backend: `POST /simulate/thermal`, isolated swappable
  physics engine, trajectory upload to Supabase, signed-URL response. 13 tests.
- [ ] **Step 3 (NEXT)** — Dashboard UI: `.pdb` upload + "Run Thermal Stress
  Test" button calling the backend, and an NGL Viewer that animates the returned
  trajectory. See "Step 3 spec" below.

## Architecture & hard boundaries

These rules are load-bearing. Do not violate them without explicit instruction.

1. **`backend/app/physics/` is isolated.** It imports nothing from FastAPI,
   Supabase, or any IO/web layer — only `structure`, `pdb`, NumPy. To add a real
   engine (OpenMM/ASE/Geant4), implement `SimulationEngine.run()` in a new module
   under `physics/` and construct it in `api/routes/simulate.py`. Change nothing
   else. Keep this folder pure.
2. **Secrets split by trust boundary.** `SUPABASE_SERVICE_ROLE_KEY` lives ONLY in
   `backend/.env` (it bypasses RLS). The frontend gets ONLY `NEXT_PUBLIC_*` vars
   (URL + anon key). Never move the service-role key into the frontend or any
   `NEXT_PUBLIC_*` name.
3. **Storage path convention:** every object is keyed
   `molecular-simulations/<user_id>/<sim_id>/<file>`. RLS enforces this for
   browser reads; the backend (service-role) honors the same prefix by contract.
4. **Two `middleware.ts` files, both intentional:**
   `frontend/middleware.ts` (root) is Next's edge middleware — must stay at
   frontend root. `frontend/src/lib/supabase/middleware.ts` is the `updateSession`
   helper it imports. Do not merge or relocate them.
5. **Auth is double-gated:** middleware guards routes AND each protected page
   re-checks `supabase.auth.getUser()`. Keep both.

## Tech stack (pinned)

- Next.js **15.3.9** (App Router, React 19, Server Actions), Tailwind 3.4
- `@supabase/ssr` ^0.5.2, `@supabase/supabase-js` ^2.48 (cookie-based sessions)
- Python 3.12, FastAPI ~0.115, Pydantic 2 + pydantic-settings, NumPy, supabase ~2.9
- Do not downgrade Next below 15.3.x — earlier 15.1.x has a security advisory.

## Commands

Frontend (`cd frontend`):
```bash
npm install                 # REQUIRED after clone/extract (node_modules is not shipped)
npm run dev                 # http://localhost:3000
npm run typecheck           # tsc --noEmit  (NOT `npx tsc` — that resolves a decoy pkg if deps missing)
npm run lint
npm run build
```

Backend (`cd backend`):
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000    # docs at /docs, health at /health
pytest                                        # 13 tests, no network needed
```

Supabase: apply `supabase/migrations/0001_storage_molecular_simulations.sql` via
`supabase db push` or the SQL editor. Enable Email auth in the dashboard.

## The API contract

`POST /simulate/thermal` (multipart/form-data) →
fields: `file` (.pdb, required), `n_frames` (default 50), `temp_start` (0.02),
`temp_end` (1.0), `seed` (42), `output_format` (`pdb`|`xyz`).
Header: `Authorization: Bearer <supabase access token>` to namespace output under
the real user. Returns JSON: `{ simulation_id, engine, n_atoms, n_frames,
output_format, storage_path, file_url, expires_in }`. `file_url` is a signed URL
to the multi-frame trajectory. Engine id is `mock-thermal-noise-v1`.

## Step 3 spec (do this next)

Goal: in `frontend/src/app/dashboard/page.tsx`, replace the two placeholder
panels with a working flow.

1. **Upload** (`src/components/upload/`): a `.pdb`-only file input/dropzone
   (validate extension + reject empty). Client component.
2. **Run**: once a file is selected, show a "Run Thermal Stress Test" button.
   On click: get the session token via `supabase.auth.getSession()`, POST the
   file as multipart to `${NEXT_PUBLIC_API_BASE_URL}/simulate/thermal` with the
   `Authorization: Bearer` header. Show loading + error states.
3. **Viewer** (`src/components/viewer/`): integrate **NGL Viewer** in a client
   component (`"use client"`, init in a `useEffect`, clean up the stage on
   unmount). Load the returned `file_url`. NGL note: the signed URL has a query
   string so the `.pdb` extension isn't visible — fetch it and pass a `Blob`
   with `{ ext: "pdb", asTrajectory: true }`, or use
   `stage.loadFile(url, { ext: "pdb", asTrajectory: true })`. Add play/pause +
   a frame slider so the user can watch the molecule vibrate and break apart.

Constraints: production-grade, heavily commented (explain the physics where
relevant); CORS is already configured in `backend/app/main.py`; keep the physics
swappable (don't add physics to the frontend). Follow the design system in
`frontend/src/app/globals.css` (thermal-ramp palette, mono instrument labels).

## Conventions

**Git — Feature-Branch Workflow (strict):**
- `main` = production (never commit directly). `develop` = integration.
  `feature/<name>` for work, `hotfix/<name>` from `main`.
- Branch features off `develop`; open PRs into `develop`; rebase on `develop`
  before merging; merge with `--no-ff`. Merge `develop` → `main` only for releases.
- **Conventional Commits:** `type(scope): imperative summary`
  (`feat`, `fix`, `docs`, `refactor`, `chore`, `test`). Small, single-intent.

**Code:**
- Physics logic stays modular and separate from API/frontend.
- Comment the *why*, including the physics principle behind a block (thermal
  dynamics, radiation interaction) where it applies.
- Frontend: TypeScript, Server Actions for mutations, minimal client components.
- Backend: type hints everywhere; keep route handlers thin (parse → engine →
  store); inject dependencies via `api/deps.py` so they're overridable in tests.

## Gotchas

- `node_modules/` and `backend/.venv/` are NOT in the repo/archive — install first.
- `next build` fetches Google Fonts at build time; needs network access.
- `tsconfig.tsbuildinfo` may sit in `frontend/` (generated, git-ignored).
- `docs/` is an empty reserved dir; git won't track it until it has a file.
