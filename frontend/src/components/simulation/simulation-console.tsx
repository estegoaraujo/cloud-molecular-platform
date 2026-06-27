"use client";

/**
 * SimulationConsole — the Step 3 dashboard flow, end to end.
 *
 * It orchestrates three concerns and owns the state that connects them:
 *   1. selecting a `.pdb`            → PdbDropzone
 *   2. running the thermal stress    → runThermalSimulation() (backend call)
 *   3. animating the result          → TrajectoryViewer (NGL)
 *
 * All physics stays on the backend; this component only moves files and a few
 * scalar parameters around (see CLAUDE.md "keep the physics swappable").
 */
import { useState } from "react";
import { PdbDropzone } from "@/components/upload/pdb-dropzone";
import { TrajectoryViewer } from "@/components/viewer/trajectory-viewer";
import {
  runThermalSimulation,
  DEFAULT_THERMAL_PARAMS,
  SimulationError,
  type ThermalParams,
  type SimulationResult,
} from "@/lib/api";

type RunState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; result: SimulationResult }
  | { phase: "error"; message: string };

/** A labelled numeric instrument field used in the parameters grid. */
function ParamField({
  label,
  hint,
  value,
  onChange,
  step,
  min,
  disabled,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="mono-label">{label}</span>
      <input
        type="number"
        className="field"
        value={value}
        step={step}
        min={min}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="text-[0.7rem] text-muted">{hint}</span>
    </label>
  );
}

export function SimulationConsole() {
  const [file, setFile] = useState<File | null>(null);
  const [params, setParams] = useState<ThermalParams>(DEFAULT_THERMAL_PARAMS);
  const [run, setRun] = useState<RunState>({ phase: "idle" });

  const running = run.phase === "running";
  const result = run.phase === "done" ? run.result : null;

  const setParam = (key: keyof ThermalParams) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));

  async function onRun() {
    if (!file) return;
    setRun({ phase: "running" });
    try {
      const result = await runThermalSimulation(file, params);
      setRun({ phase: "done", result });
    } catch (err) {
      // SimulationError carries a user-facing message; anything else is a bug.
      const message =
        err instanceof SimulationError
          ? err.message
          : "Unexpected error running the simulation.";
      setRun({ phase: "error", message });
    }
  }

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[360px_1fr]">
      {/* ── Input column: upload + parameters + run ─────────────────────── */}
      <section className="panel rounded-xl p-5">
        <div className="spectral-ramp absolute inset-x-0 top-0 h-0.5 rounded-t-xl" />
        <p className="mono-label">{"// input · structure"}</p>
        <h2 className="mt-2 font-display text-lg font-medium">Upload a .pdb</h2>
        <p className="mt-1 text-sm text-muted">
          Provide a structure, set the thermal ramp, then apply stress.
        </p>

        <div className="mt-4">
          <PdbDropzone onSelect={setFile} selected={file} disabled={running} />
        </div>

        {/* Thermal ramp parameters. temp_start → temp_end is the heating curve
            applied over n_frames; seed makes the run reproducible. */}
        <fieldset className="mt-5 grid grid-cols-2 gap-3" disabled={running}>
          <legend className="mono-label mb-1">{"// thermal ramp"}</legend>
          <ParamField
            label="Frames"
            hint="trajectory length"
            value={params.nFrames}
            onChange={setParam("nFrames")}
            step={1}
            min={1}
          />
          <ParamField
            label="Seed"
            hint="reproducibility"
            value={params.seed}
            onChange={setParam("seed")}
            step={1}
          />
          <ParamField
            label="T start"
            hint="initial energy"
            value={params.tempStart}
            onChange={setParam("tempStart")}
            step={0.01}
            min={0}
          />
          <ParamField
            label="T end"
            hint="peak energy"
            value={params.tempEnd}
            onChange={setParam("tempEnd")}
            step={0.01}
            min={0}
          />
        </fieldset>

        <button
          type="button"
          onClick={onRun}
          disabled={!file || running}
          className="btn-primary mt-5 w-full"
        >
          {running ? "Running stress test…" : "Run Thermal Stress Test"}
        </button>

        {run.phase === "error" && (
          <p role="alert" className="mt-3 text-sm text-hot">
            {run.message}
          </p>
        )}

        {result && (
          <dl className="mt-4 space-y-1 border-t border-line pt-3 font-mono text-xs text-muted">
            <div className="flex justify-between">
              <dt>engine</dt>
              <dd className="text-ink">{result.engine}</dd>
            </div>
            <div className="flex justify-between">
              <dt>atoms</dt>
              <dd className="text-ink tabular-nums">{result.n_atoms}</dd>
            </div>
            <div className="flex justify-between">
              <dt>frames</dt>
              <dd className="text-ink tabular-nums">{result.n_frames}</dd>
            </div>
          </dl>
        )}
      </section>

      {/* ── Output column: the animated trajectory ──────────────────────── */}
      <section className="panel rounded-xl p-5">
        <div className="spectral-ramp absolute inset-x-0 top-0 h-0.5 rounded-t-xl" />
        <p className="mono-label">{"// output · trajectory"}</p>
        <h2 className="mt-2 font-display text-lg font-medium">
          Destabilization viewer
        </h2>
        <p className="mt-1 text-sm text-muted">
          Press play to watch the structure heat up and break apart.
        </p>

        <div className="mt-4">
          <TrajectoryViewer fileUrl={result?.file_url ?? null} />
        </div>
      </section>
    </div>
  );
}
