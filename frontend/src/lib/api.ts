/**
 * Client for the ThermRad physics backend (FastAPI).
 *
 * This module is the single place the browser talks to the simulation service.
 * Keeping the fetch plumbing here (rather than in components) means the API
 * contract lives in one typed surface, and the UI layer only deals in
 * `SimulationResult` objects.
 *
 * Trust boundary: we send the user's Supabase *access token* as a Bearer
 * header. The backend uses it only to namespace storage under the real user id
 * (`molecular-simulations/<user_id>/...`). The anon-key browser session never
 * sees the service-role key — that stays on the backend (see CLAUDE.md §2).
 */
import { createClient } from "@/lib/supabase/client";

/** Mirrors the JSON returned by `POST /simulate/thermal`. */
export type SimulationResult = {
  simulation_id: string;
  engine: string;
  n_atoms: number;
  n_frames: number;
  output_format: "pdb" | "xyz";
  storage_path: string;
  /** Signed URL to the multi-frame trajectory file. Expires; see expires_in. */
  file_url: string;
  expires_in: number;
};

/**
 * Tunable parameters for the thermal stress run.
 *
 * The physics: the engine heats the structure from `temp_start` to `temp_end`
 * over `n_frames` steps (a linear thermal ramp). Higher temperatures inject
 * more kinetic noise into atomic positions, so the molecule vibrates harder and
 * eventually destabilizes — which is exactly what the viewer animates. `seed`
 * makes a run reproducible.
 */
export type ThermalParams = {
  nFrames: number;
  tempStart: number;
  tempEnd: number;
  seed: number;
};

/** Defaults match the backend's API contract (CLAUDE.md "The API contract"). */
export const DEFAULT_THERMAL_PARAMS: ThermalParams = {
  nFrames: 50,
  tempStart: 0.02,
  tempEnd: 1.0,
  seed: 42,
};

/** Raised when the run cannot proceed or the backend returns an error. */
export class SimulationError extends Error {}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Upload a `.pdb` and run a thermal stress simulation.
 *
 * Steps: resolve the current session token → POST the file as multipart →
 * parse the typed result. Throws `SimulationError` with a human-readable
 * message on any failure so the UI can surface it directly.
 */
export async function runThermalSimulation(
  file: File,
  params: ThermalParams = DEFAULT_THERMAL_PARAMS,
): Promise<SimulationResult> {
  if (!API_BASE) {
    throw new SimulationError(
      "NEXT_PUBLIC_API_BASE_URL is not set — cannot reach the physics backend.",
    );
  }

  // The backend namespaces output under the authenticated user, so it needs a
  // valid access token. getSession() reads it from the cookie-based session.
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new SimulationError("Your session has expired. Please sign in again.");
  }

  // We request `pdb` output: a multi-MODEL PDB is the most reliable trajectory
  // format for NGL's ball+stick representation (bonds are inferred per frame).
  const form = new FormData();
  form.append("file", file);
  form.append("n_frames", String(params.nFrames));
  form.append("temp_start", String(params.tempStart));
  form.append("temp_end", String(params.tempEnd));
  form.append("seed", String(params.seed));
  form.append("output_format", "pdb");

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/simulate/thermal`, {
      method: "POST",
      headers: {
        // Do NOT set Content-Type — the browser adds the multipart boundary.
        Authorization: `Bearer ${session.access_token}`,
      },
      body: form,
    });
  } catch (cause) {
    // Network-level failure (backend down, CORS, DNS). fetch rejects here.
    throw new SimulationError(
      "Could not reach the simulation backend. Is it running?",
      { cause },
    );
  }

  if (!res.ok) {
    // FastAPI returns `{ detail: ... }` on errors; fall back to status text.
    const detail = await safeDetail(res);
    throw new SimulationError(
      detail ?? `Simulation failed (HTTP ${res.status}).`,
    );
  }

  return (await res.json()) as SimulationResult;
}

/** Best-effort extraction of FastAPI's `detail` field from an error response. */
async function safeDetail(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      // Pydantic validation errors come as an array of {msg, loc} objects.
      return body.detail
        .map((e) => (e as { msg?: string }).msg)
        .filter(Boolean)
        .join("; ");
    }
    return null;
  } catch {
    return null;
  }
}
