"use client";

/**
 * TrajectoryViewer — animates a returned simulation trajectory with NGL.
 *
 * The backend writes a multi-MODEL `.pdb` (one MODEL per frame) and hands back a
 * *signed* URL. Two NGL-specific wrinkles drive the design here:
 *
 *  1. NGL only runs in the browser (it touches `window`/WebGL), so we never
 *     import it at module scope — it's dynamically imported inside the effect.
 *     The component is also rendered client-side only by its parent.
 *  2. The signed URL carries a query string, so the `.pdb` extension isn't
 *     visible to NGL's format sniffer. We fetch the file ourselves and hand NGL
 *     a Blob with an explicit `{ ext: "pdb", asTrajectory: true }`.
 *
 * Physics note: each MODEL is the structure at a higher temperature along the
 * thermal ramp. Playing the frames in sequence is literally watching kinetic
 * energy accumulate — atoms vibrate with growing amplitude until bonds strain
 * and the structure comes apart.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Stage, StructureComponent, TrajectoryPlayer } from "ngl";

// Derive the Trajectory type from the public API surface (NGL doesn't export
// the class by name, but addTrajectory()'s return type does expose it).
type TrajectoryElement = ReturnType<StructureComponent["addTrajectory"]>;
type Trajectory = TrajectoryElement["trajectory"];

type Props = {
  /** Signed URL to the multi-frame .pdb trajectory, or null before a run. */
  fileUrl: string | null;
};

/** Milliseconds between frames while playing (~16 fps — slow enough to read). */
const FRAME_TIMEOUT = 60;

export function TrajectoryViewer({ fileUrl }: Props) {
  // The DOM node NGL renders its canvas into.
  const mountRef = useRef<HTMLDivElement>(null);

  // NGL objects live outside React's render cycle; keep them in refs so effects
  // can tear them down deterministically without triggering re-renders.
  const stageRef = useRef<Stage | null>(null);
  const trajRef = useRef<Trajectory | null>(null);
  const playerRef = useRef<TrajectoryPlayer | null>(null);

  // React-facing state that mirrors the trajectory so the controls can render.
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    fileUrl ? "loading" : "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!fileUrl || !mountRef.current) return;

    // `cancelled` guards against React 18/19 StrictMode double-invocation and
    // against `fileUrl` changing mid-load: a stale async build must not attach
    // its stage after cleanup has run.
    let cancelled = false;
    setStatus("loading");
    setErrorMsg(null);
    setPlaying(false);
    setFrame(0);
    setFrameCount(0);

    (async () => {
      // Dynamic import keeps NGL out of the server bundle entirely.
      const NGL = await import("ngl");

      // Background matches the --void token so the canvas blends into the panel.
      const stage = new NGL.Stage(mountRef.current!, { backgroundColor: "#07090e" });
      if (cancelled) {
        stage.dispose();
        return;
      }
      stageRef.current = stage;

      try {
        // Fetch the signed URL ourselves (see header note #2) and load the Blob
        // as a trajectory so every MODEL becomes an animatable frame.
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching trajectory`);
        const blob = await res.blob();
        if (cancelled) return;

        const comp = (await stage.loadFile(blob, {
          ext: "pdb",
          asTrajectory: true,
        })) as StructureComponent | undefined;
        if (cancelled || !comp) return;

        // Ball-and-stick makes individual bonds visible, so the moment they
        // stretch and snap reads clearly. Color by element for legibility.
        comp.addRepresentation("ball+stick", { multipleBond: "symmetric" });
        comp.autoView();

        // Build a trajectory from the in-memory frames and wire its signals to
        // React state so the slider/label stay in sync with what's on screen.
        const traj = comp.addTrajectory().trajectory;
        trajRef.current = traj;

        const syncCount = () => {
          if (!cancelled) setFrameCount(Math.max(0, traj.frameCount));
        };
        const syncFrame = (i: number) => {
          if (!cancelled) setFrame(i);
        };
        traj.signals.countChanged.add(syncCount);
        traj.signals.frameChanged.add(syncFrame);
        syncCount(); // frames are already parsed from the multi-MODEL PDB

        // A player drives playback; we listen to frameChanged for the slider,
        // and flip our `playing` flag when it stops at the end (non-loop modes).
        const player = new NGL.TrajectoryPlayer(traj, {
          step: 1,
          timeout: FRAME_TIMEOUT,
          start: 0,
          end: traj.frameCount,
          mode: "once",
          direction: "forward",
        });
        player.signals.haltedRunning.add(() => {
          if (!cancelled) setPlaying(false);
        });
        playerRef.current = player;

        traj.setFrame(0);
        if (!cancelled) setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(
          err instanceof Error ? err.message : "Failed to render the trajectory.",
        );
      }
    })();

    // Keep the canvas correctly sized inside its flexible panel.
    const ro = new ResizeObserver(() => stageRef.current?.handleResize());
    ro.observe(mountRef.current);

    return () => {
      cancelled = true;
      ro.disconnect();
      playerRef.current?.pause();
      playerRef.current = null;
      trajRef.current = null;
      // dispose() tears down the WebGL context, canvas, and event listeners.
      stageRef.current?.dispose();
      stageRef.current = null;
    };
  }, [fileUrl]);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    const traj = trajRef.current;
    if (!player || !traj) return;
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      // Restart from the beginning if we're parked on the last frame.
      if (traj.currentFrame >= traj.frameCount - 1) traj.setFrame(0);
      player.play();
      setPlaying(true);
    }
  }, [playing]);

  const scrub = useCallback((value: number) => {
    const player = playerRef.current;
    const traj = trajRef.current;
    if (!traj) return;
    player?.pause();
    setPlaying(false);
    traj.setFrame(value);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* The viewport. NGL needs a sized element, hence the fixed min-height. */}
      <div className="relative overflow-hidden rounded-lg border border-line bg-void">
        <div ref={mountRef} className="h-[420px] w-full" />

        {status !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <p className="mono-label">
              {status === "loading" && "// rendering trajectory…"}
              {status === "error" && (
                <span className="text-hot">{errorMsg ?? "// render error"}</span>
              )}
              {status === "idle" && "// awaiting simulation"}
            </p>
          </div>
        )}
      </div>

      {/* Transport controls — only meaningful once frames exist. */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          disabled={status !== "ready" || frameCount <= 1}
          className="btn-ghost w-24 disabled:opacity-50"
        >
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(0, frameCount - 1)}
          value={frame}
          onChange={(e) => scrub(Number(e.target.value))}
          disabled={status !== "ready" || frameCount <= 1}
          aria-label="Trajectory frame"
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-panel-2 accent-cold disabled:opacity-50"
        />

        {/* Frame readout doubles as a crude thermometer: late frames = hotter. */}
        <span className="mono-label w-24 text-right tabular-nums">
          {frameCount > 0 ? `${frame + 1} / ${frameCount}` : "— / —"}
        </span>
      </div>
    </div>
  );
}
